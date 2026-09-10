// SPDX-License-Identifier: GPL-3.0-or-later
// background.js - service worker.
// Owns ONE resilient WebSocket to the local bridge (ws://127.0.0.1:PORT).
// Keeping the socket here (not in the content script) avoids https→ws mixed
// content issues and centralises reconnect / timeout logic.
//
// Contract with content.js: every sendMessage ALWAYS gets a response object,
// even when the bridge is offline. The agentic loop must never hang waiting.

const PORT = 17613;
const URL = `ws://127.0.0.1:${PORT}`;

// Chat sites where a ZeroScript provider content script runs. Status pushes go
// to every tab matching these. Add the new provider's URL pattern here (and in
// manifest.json content_scripts + host_permissions) when integrating another AI.
const PROVIDER_URLS = ["https://chat.deepseek.com/*", "https://chatgpt.com/*", "https://chat.openai.com/*", "https://gemini.google.com/*", "https://aistudio.google.com/*", "https://www.kimi.ai/*", "https://kimi.ai/*", "https://chat.z.ai/*", "https://chat.qwen.ai/*", "https://arena.ai/*", "https://www.meta.ai/*", "https://meta.ai/*"];

const RECONNECT_MIN = 1000;
const RECONNECT_MAX = 5000;
const HEARTBEAT_MS = 10000;
// If no message (incl. pong) arrives within this window while we believe we're
// connected, the socket is half-open: force a reconnect instead of letting
// pending requests slowly time out.
const STALE_SOCKET_MS = 25000;
const REQUEST_TIMEOUT_DEFAULT = 130000; // a bit above the 120s tool timeout

let manualStop = false;
let ws = null;
let connected = false;
let connectionState = "disconnected"; // "connected" | "disconnected" | "connecting" | "reconnecting" | "error"
let lastError = null;
let reconnectDelay = RECONNECT_MIN;
let reconnectTimer = null;
let heartbeatTimer = null;
let lastMessageAt = 0; // timestamp of the last frame received from the bridge
let nextId = 1;
const pending = new Map(); // id -> {resolve, timer}
let activeConnectorCache = "roblox";
let toolsCache = [];
let mcpAlive = false;
let serversCache = [];
let connectorsCache = [];
// true/false = a PLACE is loaded and usable in Roblox Studio; null = unknown.
// The MCP process stays alive when Studio is closed or its MCP option is off,
// so this is probed separately (bridge "studio_status").
let studioConnected = null;
// true/false = a Roblox Studio app is connected to the MCP server at all; null =
// unknown. studioApp=true with studioConnected=false means "Studio open but no
// place"; studioApp=false means "Studio closed OR its MCP option disabled".
let studioApp = null;
// true/false = a Roblox Studio WINDOW/PROCESS exists on this machine (checked
// bridge-side via tasklist); null = unknown/old bridge. Distinguishes the two
// studioApp=false sub-cases the UI must word differently: Studio genuinely not
// launched ("open Roblox Studio") vs Studio OPEN but its MCP plugin never
// registered with the bridge - the documented fix for the latter is opening
// Assistant Settings > MCP Servers inside Studio (validated live 3x), which
// "open Roblox Studio" wording completely fails to convey.
let studioProc = null;
let nativeHostAvailable = false;
const auditLog = [];
const MAX_AUDIT_LOG = 50;

function recordAudit(entry) {
  auditLog.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: Date.now(),
    timeStr: new Date().toLocaleTimeString(),
    ...entry,
  });
  if (auditLog.length > MAX_AUDIT_LOG) auditLog.pop();
  broadcastStatus();
}

const NATIVE_HOST_NAME = "com.devilx.agent";
const LEGACY_NATIVE_HOST_NAME = "com.zeroscript.agent";

function sendToNativeHost(payload, callback) {
  if (!chrome.runtime.sendNativeMessage) {
    if (callback) callback({ ok: false, error: "Native messaging not supported" });
    return;
  }
  chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, payload, (resp) => {
    if (chrome.runtime.lastError) {
      chrome.runtime.sendNativeMessage(LEGACY_NATIVE_HOST_NAME, payload, (legacyResp) => {
        if (callback) callback(legacyResp);
      });
      return;
    }
    if (callback) callback(resp);
  });
}

function checkNativeHost() {
  if (!chrome.runtime.sendNativeMessage) {
    nativeHostAvailable = false;
    return;
  }
  try {
    sendToNativeHost({ action: "ping" }, (response) => {
      if (!response || response.ok === false) {
        nativeHostAvailable = false;
      } else {
        nativeHostAvailable = true;
        log("native messaging host active (" + (response.host || NATIVE_HOST_NAME) + ")");
      }
      broadcastStatus();
    });
  } catch {
    nativeHostAvailable = false;
  }
}

function log(...a) {
  console.log("[zs-bg]", ...a);
}

// ── WebSocket lifecycle ─────────────────────────────────────────────────
function connect(force = false) {
  if (manualStop && !force) {
    log("connect ignored because manualStop is true");
    return;
  }
  if (force) {
    manualStop = false;
  }
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  clearTimeout(reconnectTimer);
  if (connectionState !== "reconnecting") {
    connectionState = "connecting";
    broadcastStatus();
  }
  try {
    ws = new WebSocket(URL);
  } catch (e) {
    log("WebSocket ctor failed", e);
    connectionState = "error";
    lastError = String(e && e.message ? e.message : e);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    manualStop = false;
    connected = true;
    connectionState = "connected";
    lastError = null;
    reconnectDelay = RECONNECT_MIN;
    lastMessageAt = Date.now();
    log("connected to bridge");
    startHeartbeat();
    broadcastStatus();
  };

  ws.onmessage = (ev) => {
    lastMessageAt = Date.now();
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    handleBridgeMessage(msg);
  };

  ws.onclose = () => {
    connected = false;
    mcpAlive = false;
    studioConnected = null;
    studioApp = null;
    studioProc = null;
    serversCache = [];
    stopHeartbeat();
    failAllPending("bridge connection closed");
    if (manualStop) {
      connectionState = "disconnected";
      broadcastStatus();
      return;
    }
    if (connectionState !== "disconnected") {
      connectionState = "reconnecting";
    }
    broadcastStatus();
    scheduleReconnect();
  };

  ws.onerror = () => {
    connectionState = "error";
    lastError = "Bridge WebSocket connection failed";
    broadcastStatus();
    // onclose will follow; nothing to do here but avoid an unhandled error.
    try { ws.close(); } catch {}
  };
}

function scheduleReconnect() {
  if (manualStop) {
    connectionState = "disconnected";
    broadcastStatus();
    return;
  }
  clearTimeout(reconnectTimer);
  connectionState = "reconnecting";
  broadcastStatus();
  reconnectTimer = setTimeout(() => connect(false), reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 1.7, RECONNECT_MAX);
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (connected) {
      // Half-open socket: the WS still reports OPEN but nothing comes through.
      // The pong (and every other frame) refreshes lastMessageAt; if it has
      // gone stale, drop the dead socket so onclose triggers a reconnect.
      if (lastMessageAt && Date.now() - lastMessageAt > STALE_SOCKET_MS) {
        log("socket stale, forcing reconnect");
        try { ws.close(); } catch {}
        return;
      }
      // Keeps the MV3 service worker alive AND detects a half-open socket.
      send({ type: "ping" }).catch(() => {});
      refreshStudioStatus();
    }
  }, HEARTBEAT_MS);
}

function stopHeartbeat() {
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

// Resolve once the socket is OPEN, or false after `timeout` ms.
function waitForConnection(timeout = 8000) {
  return new Promise((resolve) => {
    if (connected && ws && ws.readyState === WebSocket.OPEN) return resolve(true);
    connect(); // nudge a (re)connection - important after a worker wake-up
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (connected && ws && ws.readyState === WebSocket.OPEN) {
        clearInterval(iv);
        resolve(true);
      } else if (Date.now() - t0 > timeout) {
        clearInterval(iv);
        resolve(false);
      }
    }, 100);
  });
}

// ── request/response over the socket ────────────────────────────────────
async function send(obj, timeout = REQUEST_TIMEOUT_DEFAULT) {
  // The MV3 service worker can be suspended; the first message after a wake-up
  // arrives before the socket has re-opened. Wait for it instead of failing -
  // otherwise Kimi wrongly hears "bridge offline".
  if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
    await waitForConnection(8000);
  }
  return new Promise((resolve) => {
    if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
      resolve({ ok: false, kind: "disconnected", error: "bridge not connected" });
      return;
    }
    const id = nextId++;
    const payload = { ...obj, id };
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve({ ok: false, kind: "timeout", error: "bridge did not respond in time" });
      }
    }, timeout);
    pending.set(id, { resolve, timer });
    try {
      ws.send(JSON.stringify(payload));
    } catch (e) {
      clearTimeout(timer);
      pending.delete(id);
      resolve({ ok: false, kind: "disconnected", error: String(e) });
    }
  });
}

// Ask the bridge whether a Roblox Studio instance is actually connected to the
// MCP server. Broadcasts only on change so the UI updates promptly but quietly.
let studioProbing = false;
async function refreshStudioStatus() {
  if (studioProbing || !connected) return;
  studioProbing = true;
  try {
    const r = await send({ type: "studio_status" }, 12000);
    const v = r && r.ok && typeof r.studio === "boolean" ? r.studio : null;
    if (v !== studioConnected) {
      studioConnected = v;
      broadcastStatus();
    }
  } finally {
    studioProbing = false;
  }
}

function handleBridgeMessage(msg) {
  if ("studio" in msg && (typeof msg.studio === "boolean" || msg.studio === null)) {
    studioConnected = msg.studio;
  }
  if ("studio_app" in msg && (typeof msg.studio_app === "boolean" || msg.studio_app === null)) {
    studioApp = msg.studio_app;
  }
  if ("studio_proc" in msg && (typeof msg.studio_proc === "boolean" || msg.studio_proc === null)) {
    studioProc = msg.studio_proc;
  }
  if (msg.active_connector && typeof msg.active_connector === "string") {
    activeConnectorCache = msg.active_connector;
  }
  if (Array.isArray(msg.connectors)) {
    connectorsCache = msg.connectors;
  }
  if (msg.type === "connectors") {
    if (Array.isArray(msg.connectors)) connectorsCache = msg.connectors;
    if (msg.active_connector) activeConnectorCache = msg.active_connector;
    resolvePending(msg.id, { ok: true, connectors: connectorsCache, active_connector: activeConnectorCache });
    broadcastStatus();
    return;
  }
  if (msg.type === "connector_changed") {
    if (msg.active) activeConnectorCache = msg.active;
    resolvePending(msg.id, { ok: !!msg.ok, active: activeConnectorCache });
    broadcastStatus();
    return;
  }
  if (msg.type === "studio_status") {
    resolvePending(msg.id, { ok: true, studio: studioConnected });
    broadcastStatus();
    return;
  }
  if (msg.type === "connected") {
    mcpAlive = !!msg.mcp_alive;
    if (Array.isArray(msg.tools)) toolsCache = msg.tools;
    if (Array.isArray(msg.servers)) serversCache = msg.servers;
    if (Array.isArray(msg.connectors)) connectorsCache = msg.connectors;
    if (msg.active_connector) activeConnectorCache = msg.active_connector;
    broadcastStatus();
    return;
  }
  if (msg.type === "pong") {
    resolvePending(msg.id, { ok: true });
    return;
  }
  if (msg.type === "tools") {
    if (Array.isArray(msg.tools)) toolsCache = msg.tools;
    if (Array.isArray(msg.servers)) serversCache = msg.servers;
    mcpAlive = !!msg.mcp_alive;
    resolvePending(msg.id, { ok: true, tools: toolsCache });
    broadcastStatus();
    return;
  }
  if (msg.type === "tool_result") {
    resolvePending(msg.id, msg.ok
      ? { ok: true, text: msg.text, images: msg.images || [] }
      : { ok: false, kind: msg.kind, error: msg.error });
    return;
  }
  if (msg.type === "mcp_status") {
    mcpAlive = !!msg.alive;
    if (Array.isArray(msg.tools)) toolsCache = msg.tools;
    if (Array.isArray(msg.servers)) serversCache = msg.servers;
    resolvePending(msg.id, { ok: !!msg.ok, alive: msg.alive, error: msg.error });
    broadcastStatus();
    return;
  }
  if (msg.type === "server_changed") {
    // The bridge acks, then restarts itself to reload config.json. The socket
    // will drop right after this - the content script shows a spinner until the
    // reconnect lands and a fresh status arrives.
    resolvePending(msg.id, { ok: !!msg.ok, error: msg.error, restarting: !!msg.restarting });
    return;
  }
  if (msg.type === "error") {
    resolvePending(msg.id, { ok: false, error: msg.error });
    return;
  }
}

function resolvePending(id, value) {
  const p = pending.get(id);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(id);
  p.resolve(value);
}

function failAllPending(reason) {
  for (const [, p] of pending) {
    clearTimeout(p.timer);
    p.resolve({ ok: false, kind: "disconnected", error: reason });
  }
  pending.clear();
}

// ── status push to any open AI tab + popup ─────────────────────────
function statusObj() {
  return {
    type: "zs-status",
    connected,
    connectionState, // "connected" | "disconnected" | "connecting" | "reconnecting" | "error"
    lastError,
    mcpAlive,
    studio: studioConnected,
    studioApp,
    studioProc,
    tools: toolsCache.length,
    servers: serversCache,
    connectors: connectorsCache,
    active_connector: activeConnectorCache,
    nativeHost: nativeHostAvailable,
    recentAudit: auditLog.slice(0, 10),
  };
}

function broadcastStatus() {
  chrome.runtime.sendMessage(statusObj()).catch(() => {});
  chrome.tabs.query({ url: PROVIDER_URLS }, (tabs) => {
    for (const t of tabs) chrome.tabs.sendMessage(t.id, statusObj()).catch(() => {});
  });
}

async function syncCustomContentScripts(customProviders) {
  if (!chrome.scripting || !chrome.scripting.registerContentScripts) return;
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts();
    const existingIds = existing.map((s) => s.id);
    if (existingIds.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: existingIds });
    }

    const scriptsToRegister = [];
    for (const p of customProviders || []) {
      if (p.enabled !== false && p.urlPattern) {
        let pat = p.urlPattern.trim();
        if (!pat.includes("://")) pat = `https://${pat}`;
        if (!pat.endsWith("*")) pat = pat.endsWith("/") ? `${pat}*` : `${pat}/*`;
        scriptsToRegister.push({
          id: `script_${p.id}`,
          matches: [pat],
          js: [
            "core/protocol.js",
            "core/connectors.js",
            "core/config.js",
            "core/parser.js",
            "core/main.js",
            "core/detector.js",
            "core/floating_ui.js",
          ],
          css: ["overlay.css"],
          runAt: "document_idle",
        });
      }
    }

    if (scriptsToRegister.length > 0) {
      await chrome.scripting.registerContentScripts(scriptsToRegister);
    }
  } catch (err) {
    console.warn("[background] Error syncing custom content scripts:", err);
  }
}

// Initial sync of custom providers on SW startup
chrome.storage.local.get("custom_providers", (data) => {
  if (data && data.custom_providers) {
    syncCustomContentScripts(data.custom_providers);
  }
});

// ── messages from content.js / popup.js ─────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case "status":
        if (!connected && connectionState !== "connecting" && connectionState !== "reconnecting") {
          connect(); // self-heal after a worker wake-up
        }
        checkNativeHost();
        sendResponse(statusObj());
        break;
      case "native_host_status":
        checkNativeHost();
        sendResponse({ ok: true, available: nativeHostAvailable });
        break;
      case "start_agent": {
        manualStop = false;
        if (!chrome.runtime.sendNativeMessage || !nativeHostAvailable) {
          connectionState = "disconnected";
          sendResponse({
            ok: false,
            needs_manual_start: true,
            error: "Native messaging host not found. Please run start.bat on your PC to launch Devil-X.",
          });
          break;
        }
        connectionState = "connecting";
        broadcastStatus();
        sendToNativeHost({ action: "start", windowless: true }, (resp) => {
          if (!resp || resp.ok === false) {
            connectionState = "error";
            lastError = (resp && resp.error) || "Failed to start agent via native host";
            broadcastStatus();
            sendResponse({ ok: false, error: lastError });
          } else {
            setTimeout(() => connect(true), 1500);
            sendResponse(resp || { ok: true });
          }
        });
        break;
      }
      case "stop_agent": {
        manualStop = true;
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
        stopHeartbeat();
        // If connected, ask bridge to shutdown gracefully
        if (connected && ws && ws.readyState === WebSocket.OPEN) {
          send({ type: "stop_bridge" }, 2000).catch(() => {});
        }
        connectionState = "disconnected";
        if (ws) {
          try { ws.close(); } catch {}
        }
        connected = false;
        if (chrome.runtime.sendNativeMessage && nativeHostAvailable) {
          sendToNativeHost({ action: "stop" }, (resp) => {
            broadcastStatus();
            sendResponse(resp || { ok: true });
          });
        } else {
          broadcastStatus();
          sendResponse({ ok: true });
        }
        break;
      }
      case "restart_agent": {
        manualStop = false;
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
        if (connected && ws && ws.readyState === WebSocket.OPEN) {
          send({ type: "stop_bridge" }, 2000).catch(() => {});
        }
        if (!chrome.runtime.sendNativeMessage || !nativeHostAvailable) {
          connectionState = "reconnecting";
          connect(true);
          sendResponse({ ok: true });
          break;
        }
        connectionState = "connecting";
        broadcastStatus();
        sendToNativeHost({ action: "restart", windowless: true }, (resp) => {
          setTimeout(() => connect(true), 2000);
          sendResponse(resp || { ok: true });
        });
        break;
      }
      case "reconnect": {
        manualStop = false;
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
        reconnectDelay = RECONNECT_MIN;
        connectionState = "reconnecting";
        broadcastStatus();
        if (ws) {
          try { ws.close(); } catch {}
        }
        connect(true);
        sendResponse({ ok: true });
        break;
      }
      case "emergency_stop_all": {
        manualStop = true;
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
        stopHeartbeat();
        if (connected && ws && ws.readyState === WebSocket.OPEN) {
          send({ type: "stop_bridge" }, 2000).catch(() => {});
        }
        connectionState = "disconnected";
        if (ws) {
          try { ws.close(); } catch {}
        }
        connected = false;
        // Broadcast stop to all AI tabs immediately
        chrome.tabs.query({ url: PROVIDER_URLS }, (tabs) => {
          for (const t of tabs) {
            chrome.tabs.sendMessage(t.id, { type: "zs-stop-agent" }).catch(() => {});
          }
        });
        recordAudit({ tool: "EMERGENCY_STOP", ok: true, note: "User triggered emergency halt on all tabs" });
        broadcastStatus();
        sendResponse({ ok: true });
        break;
      }
      case "get_custom_providers": {
        chrome.storage.local.get("custom_providers", (data) => {
          sendResponse({ ok: true, providers: data.custom_providers || [] });
        });
        break;
      }
      case "save_custom_provider": {
        chrome.storage.local.get("custom_providers", (data) => {
          const list = data.custom_providers || [];
          const idx = list.findIndex((p) => p.id === msg.provider.id);
          if (idx >= 0) list[idx] = msg.provider;
          else list.push(msg.provider);
          chrome.storage.local.set({ custom_providers: list }, () => {
            syncCustomContentScripts(list);
            sendResponse({ ok: true, providers: list });
          });
        });
        break;
      }
      case "delete_custom_provider": {
        chrome.storage.local.get("custom_providers", (data) => {
          const list = (data.custom_providers || []).filter((p) => p.id !== msg.id);
          chrome.storage.local.set({ custom_providers: list }, () => {
            syncCustomContentScripts(list);
            sendResponse({ ok: true, providers: list });
          });
        });
        break;
      }
      case "check_local_ai": {
        if (!connected) {
          sendResponse({ ok: false, error: "Bridge not connected" });
          break;
        }
        const r = await send({
          type: "check_local_ai",
          provider: msg.provider || "ollama",
          base_url: msg.base_url,
          model: msg.model,
        }, 8000);
        sendResponse(r);
        break;
      }
      case "test_provider_selector": {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs || !tabs[0]) {
            sendResponse({ ok: false, error: "No active tab found" });
            return;
          }
          chrome.tabs.sendMessage(tabs[0].id, { type: "test_provider_selector", selectorType: msg.selectorType, config: msg.config }, (res) => {
            if (chrome.runtime.lastError) {
              sendResponse({ ok: false, error: "Cannot reach active tab: " + chrome.runtime.lastError.message });
            } else {
              sendResponse(res || { ok: false, error: "No response from tab" });
            }
          });
        });
        break;
      }
      case "get_audit_log": {
        sendResponse({ ok: true, auditLog });
        break;
      }
      case "list_connectors": {
        const r = await send({ type: "list_connectors" }, 5000);
        sendResponse(r);
        break;
      }
      case "set_active_connector": {
        if (msg.connector_id) {
          activeConnectorCache = msg.connector_id;
        }
        const r = await send({ type: "set_active_connector", connector_id: msg.connector_id }, 5000);
        if (r && r.active) {
          activeConnectorCache = r.active;
        }
        broadcastStatus();
        sendResponse(r || { ok: true, active: activeConnectorCache });
        break;
      }
      case "list_tools": {
        // Prefer a live refresh; fall back to cache so the loop never stalls.
        const r = await send({ type: "list_tools" }, 10000);
        if (r.ok) sendResponse({ ok: true, tools: r.tools });
        else sendResponse({ ok: toolsCache.length > 0, tools: toolsCache, error: r.error });
        break;
      }
      case "call_tool": {
        const timeout = (msg.timeout || 120000) + 10000;
        const t0 = Date.now();
        const r = await send(
          { type: "call_tool", name: msg.name, arguments: msg.arguments, timeout: msg.timeout },
          timeout
        );
        recordAudit({
          tool: msg.name,
          arguments: msg.arguments,
          ok: !!r.ok,
          durationMs: Date.now() - t0,
          error: r.error || null,
        });
        sendResponse(r);
        break;
      }
      case "restart_mcp": {
        const r = await send({ type: "restart_mcp" }, 30000);
        sendResponse(r);
        break;
      }
      case "add_server": {
        const r = await send({
          type: "add_server", server_id: msg.server_id,
          command: msg.command, args: msg.args, env: msg.env,
        }, 15000);
        sendResponse(r);
        break;
      }
      case "remove_server": {
        const r = await send({ type: "remove_server", server_id: msg.server_id }, 15000);
        sendResponse(r);
        break;
      }
      case "reconnect":
        reconnectDelay = RECONNECT_MIN;
        connect();
        sendResponse({ ok: true });
        break;
      default:
        sendResponse({ ok: false, error: "unknown message" });
    }
  })();
  return true; // async sendResponse
});

// Wake/keepalive hooks.
chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);

connect();
checkNativeHost();
