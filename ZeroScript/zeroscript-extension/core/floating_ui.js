// SPDX-License-Identifier: GPL-3.0-or-later
// core/floating_ui.js - Lightweight, non-intrusive Floating Universal Control UI
// Injected into supported AI websites. Provides real-time status, connector switching,
// Start/Stop controls, and emergency Stop All without interfering with host chat DOM.

/* eslint-disable no-unused-vars */
const ZSFloatingUI = (() => {
  "use strict";

  let rootContainer = null;
  let panelOpen = false;
  let currentStatus = {
    connected: false,
    mcpAlive: false,
    studio: null,
    studioProc: null,
    connectors: [],
    recentAudit: [],
  };

  const STYLES = `
    #zs-floating-root {
      position: fixed;
      bottom: 84px;
      right: 24px;
      z-index: 2147483640;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      color: #f3f4f6;
      line-height: 1.4;
      user-select: none;
    }

    #zs-floating-btn {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 7px 12px;
      background: rgba(18, 19, 22, 0.92);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #zs-floating-btn:hover {
      background: rgba(26, 27, 32, 0.98);
      border-color: rgba(99, 102, 241, 0.45);
      transform: translateY(-1px);
    }

    .zs-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #6b7280;
      transition: background 0.2s, box-shadow 0.2s;
    }
    .zs-dot.online {
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
    }
    .zs-dot.warn {
      background: #f59e0b;
      box-shadow: 0 0 8px #f59e0b;
    }
    .zs-dot.danger {
      background: #ef4444;
      box-shadow: 0 0 8px #ef4444;
    }

    .zs-btn-label {
      font-weight: 600;
      font-size: 11.5px;
      letter-spacing: 0.2px;
    }

    #zs-floating-panel {
      position: absolute;
      bottom: 42px;
      right: 0;
      width: 290px;
      background: #16171d;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      padding: 14px;
      display: none;
      flex-direction: column;
      gap: 10px;
      animation: zsFadeIn 0.18s ease-out;
    }

    @keyframes zsFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .zs-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 8px;
    }
    .zs-panel-title {
      font-weight: 600;
      font-size: 12px;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .zs-close-btn {
      background: transparent;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      font-size: 14px;
      padding: 0 4px;
    }
    .zs-close-btn:hover { color: #fff; }

    .zs-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11.5px;
    }
    .zs-muted { color: #9ca3af; }

    .zs-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 500;
      background: rgba(255, 255, 255, 0.08);
      color: #e5e7eb;
    }
    .zs-badge.success { background: rgba(16, 185, 129, 0.15); color: #34d399; }
    .zs-badge.warn { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
    .zs-badge.danger { background: rgba(239, 68, 68, 0.15); color: #f87171; }
    .zs-badge.info { background: rgba(99, 102, 241, 0.15); color: #a5b4fc; }

    .zs-connector-group {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 5px;
      margin-top: 4px;
    }
    .zs-conn-btn {
      padding: 5px 6px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.04);
      border-radius: 6px;
      color: #d1d5db;
      font-size: 10.5px;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;
    }
    .zs-conn-btn:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    .zs-conn-btn.active {
      border-color: #6366f1;
      background: rgba(99, 102, 241, 0.15);
      color: #fff;
      font-weight: 600;
    }

    .zs-actions {
      display: flex;
      gap: 6px;
      margin-top: 4px;
    }
    .zs-act-btn {
      flex: 1;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.06);
      color: #f3f4f6;
      font-size: 11px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: all 0.15s;
    }
    .zs-act-btn:hover {
      background: rgba(255, 255, 255, 0.12);
    }
    .zs-act-btn.stop {
      background: rgba(239, 68, 68, 0.12);
      border-color: rgba(239, 68, 68, 0.3);
      color: #f87171;
    }
    .zs-act-btn.stop:hover {
      background: rgba(239, 68, 68, 0.22);
    }

    .zs-recent-cmd {
      background: rgba(0, 0, 0, 0.25);
      padding: 6px 8px;
      border-radius: 6px;
      font-family: ui-monospace, monospace;
      font-size: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  `;

  function init() {
    if (document.getElementById("zs-floating-root")) return;

    // Inject styles
    const styleEl = document.createElement("style");
    styleEl.textContent = STYLES;
    (document.head || document.documentElement).appendChild(styleEl);

    // Build DOM
    rootContainer = document.createElement("div");
    rootContainer.id = "zs-floating-root";

    rootContainer.innerHTML = `
      <div id="zs-floating-panel">
        <div class="zs-panel-header">
          <div class="zs-panel-title">
            <span id="zs-panel-dot" class="zs-dot"></span>
            <span>ZeroScript Universal</span>
          </div>
          <button id="zs-panel-close" class="zs-close-btn" title="Close">×</button>
        </div>

        <div class="zs-row">
          <span class="zs-muted">Agent Bridge</span>
          <span id="zs-panel-bridge-status" class="zs-badge">Offline</span>
        </div>

        <div class="zs-row">
          <span class="zs-muted">AI Provider</span>
          <span id="zs-panel-provider" class="zs-badge info">Active</span>
        </div>

        <div>
          <div class="zs-muted" style="font-size:10.5px;margin-bottom:3px;">Target Software</div>
          <div class="zs-connector-group" id="zs-panel-connectors">
            <button class="zs-conn-btn active" data-cid="roblox">Roblox</button>
            <button class="zs-conn-btn" data-cid="vscode">VS Code</button>
            <button class="zs-conn-btn" data-cid="unity">Unity</button>
            <button class="zs-conn-btn" data-cid="android_studio">Android</button>
          </div>
        </div>

        <div id="zs-recent-container" style="display:none;">
          <div class="zs-muted" style="font-size:10px;margin-bottom:3px;">Last Command</div>
          <div class="zs-recent-cmd">
            <span id="zs-recent-tool">None</span>
            <span id="zs-recent-status" class="zs-badge success">OK</span>
          </div>
        </div>

        <div class="zs-actions">
          <button id="zs-btn-reconnect" class="zs-act-btn">↻ Reconnect</button>
          <button id="zs-btn-stop" class="zs-act-btn stop">🛑 Stop All</button>
        </div>
      </div>

      <div id="zs-floating-btn" title="ZeroScript Universal Agent">
        <span id="zs-btn-dot" class="zs-dot"></span>
        <span class="zs-btn-label">ZeroScript</span>
        <span id="zs-btn-target" class="zs-badge" style="font-size:9.5px;padding:1px 5px;">Roblox</span>
      </div>
    `;

    (document.body || document.documentElement).appendChild(rootContainer);
    bindEvents();
    queryInitialStatus();
  }

  function bindEvents() {
    const btn = document.getElementById("zs-floating-btn");
    const panel = document.getElementById("zs-floating-panel");
    const closeBtn = document.getElementById("zs-panel-close");
    const reconnectBtn = document.getElementById("zs-btn-reconnect");
    const stopBtn = document.getElementById("zs-btn-stop");
    const connBtns = document.querySelectorAll(".zs-conn-btn");

    btn?.addEventListener("click", (e) => {
      e.stopPropagation();
      panelOpen = !panelOpen;
      panel.style.display = panelOpen ? "flex" : "none";
    });

    closeBtn?.addEventListener("click", () => {
      panelOpen = false;
      panel.style.display = "none";
    });

    // Close when clicking outside panel
    document.addEventListener("click", (e) => {
      if (panelOpen && !rootContainer.contains(e.target)) {
        panelOpen = false;
        panel.style.display = "none";
      }
    });

    reconnectBtn?.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "reconnect" });
    });

    stopBtn?.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "emergency_stop_all" });
      stopBtn.textContent = "Halted!";
      setTimeout(() => { stopBtn.textContent = "🛑 Stop All"; }, 1500);
    });

    connBtns.forEach((cb) => {
      cb.addEventListener("click", () => {
        const cid = cb.getAttribute("data-cid");
        if (cid) {
          chrome.runtime.sendMessage({ type: "set_active_connector", connector_id: cid }, () => {
            connBtns.forEach((b) => b.classList.remove("active"));
            cb.classList.add("active");
            const targetBadge = document.getElementById("zs-btn-target");
            if (targetBadge) targetBadge.textContent = cb.textContent;
          });
        }
      });
    });
  }

  function updateUI(status) {
    if (!status) return;
    currentStatus = status;

    const btnDot = document.getElementById("zs-btn-dot");
    const panelDot = document.getElementById("zs-panel-dot");
    const bridgeStatusBadge = document.getElementById("zs-panel-bridge-status");
    const providerBadge = document.getElementById("zs-panel-provider");
    const targetBadge = document.getElementById("zs-btn-target");

    const isConnected = !!status.connected;

    // Dot colors
    const dotClass = isConnected ? "zs-dot online" : "zs-dot danger";
    if (btnDot) btnDot.className = dotClass;
    if (panelDot) panelDot.className = dotClass;

    if (bridgeStatusBadge) {
      bridgeStatusBadge.className = isConnected ? "zs-badge success" : "zs-badge danger";
      bridgeStatusBadge.textContent = isConnected ? "Connected" : "Offline";
    }

    // Active AI name
    let aiName = "AI Chat";
    const host = window.location.hostname;
    if (host.includes("deepseek")) aiName = "DeepSeek";
    else if (host.includes("chatgpt") || host.includes("openai")) aiName = "ChatGPT";
    else if (host.includes("gemini")) aiName = "Gemini";
    else if (host.includes("aistudio")) aiName = "AI Studio";
    else if (host.includes("kimi")) aiName = "Kimi";
    else if (host.includes("chat.z.ai")) aiName = "GLM";
    else if (host.includes("qwen")) aiName = "Qwen";
    else if (host.includes("arena")) aiName = "Arena";
    else if (host.includes("meta")) aiName = "Meta AI";

    if (providerBadge) providerBadge.textContent = aiName;

    // Connectors
    if (status.connectors && status.connectors.length) {
      const activeConn = status.connectors.find((c) => c.is_active);
      if (activeConn) {
        if (targetBadge) targetBadge.textContent = activeConn.name.split(" ")[0];
        document.querySelectorAll(".zs-conn-btn").forEach((b) => {
          if (b.getAttribute("data-cid") === activeConn.id) b.classList.add("active");
          else b.classList.remove("active");
        });
      }
    }

    // Recent Audit
    if (status.recentAudit && status.recentAudit.length) {
      const last = status.recentAudit[0];
      const recentCont = document.getElementById("zs-recent-container");
      const toolEl = document.getElementById("zs-recent-tool");
      const statEl = document.getElementById("zs-recent-status");

      if (recentCont && toolEl && statEl) {
        recentCont.style.display = "block";
        toolEl.textContent = (last.tool || "command").slice(0, 18);
        statEl.className = last.ok !== false ? "zs-badge success" : "zs-badge danger";
        statEl.textContent = last.ok !== false ? "OK" : "ERR";
      }
    }
  }

  function queryInitialStatus() {
    chrome.runtime.sendMessage({ type: "status" }, (res) => {
      if (res) updateUI(res);
    });
  }

  // Listen for runtime broadcasts
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "zs-status") {
      updateUI(msg);
    }
  });

  // Auto-init on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    init,
    updateUI,
  };
})();
