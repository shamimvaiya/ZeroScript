// SPDX-License-Identifier: GPL-3.0-or-later
// core/floating_ui.js - Compact Floating AI Website Control Widget
// Non-intrusive floating button and lightweight popup for supported AI websites.

/* eslint-disable no-unused-vars */
const ZSFloatingUI = (() => {
  "use strict";

  let rootContainer = null;
  let panelOpen = false;
  let isConnected = false;

  const TARGET_NAMES = {
    roblox: "Roblox Studio",
    vscode: "VS Code",
    unity: "Unity",
    android_studio: "Android Studio",
  };

  const STYLES = `
    #zs-floating-root {
      position: fixed;
      bottom: 84px;
      right: 24px;
      z-index: 2147483640;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11.5px;
      color: #f3f4f6;
      line-height: 1.4;
      user-select: none;
    }

    #zs-floating-btn {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 6px 12px;
      background: rgba(18, 19, 23, 0.94);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      transition: all 0.15s ease;
    }
    #zs-floating-btn:hover {
      background: rgba(26, 27, 33, 0.98);
      border-color: rgba(99, 102, 241, 0.45);
      transform: translateY(-1px);
    }

    .zs-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #6b7280;
      transition: background 0.2s;
    }
    .zs-dot.online {
      background: #10b981;
      box-shadow: 0 0 6px #10b981;
    }
    .zs-dot.danger {
      background: #ef4444;
      box-shadow: 0 0 6px #ef4444;
    }

    .zs-btn-label {
      font-weight: 600;
      font-size: 11px;
    }

    .zs-target-pill {
      font-size: 9.5px;
      padding: 1px 5px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
    }

    #zs-floating-panel {
      position: absolute;
      bottom: 38px;
      right: 0;
      width: 250px;
      background: #15171e;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.55);
      padding: 12px;
      display: none;
      flex-direction: column;
      gap: 8px;
      animation: zsFadeIn 0.15s ease-out;
    }

    @keyframes zsFadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .zs-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 6px;
    }
    .zs-panel-title {
      font-weight: 600;
      font-size: 11.5px;
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
      padding: 0 2px;
      line-height: 1;
    }
    .zs-close-btn:hover { color: #fff; }

    .zs-status-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 6px;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .zs-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10.5px;
    }
    .zs-muted { color: #9ca3af; }

    .zs-badge {
      display: inline-flex;
      align-items: center;
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 500;
      background: rgba(255, 255, 255, 0.08);
      color: #e5e7eb;
    }
    .zs-dot.warn,
    .zs-dot.connecting {
      background: #f59e0b;
      box-shadow: 0 0 6px #f59e0b;
      animation: zsPulse 1.5s infinite ease-in-out;
    }

    @keyframes zsPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.9); }
    }

    .zs-badge.warn { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }

    .zs-notice {
      padding: 4px 6px;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.35);
      border-radius: 5px;
      color: #fbbf24;
      font-size: 10px;
      line-height: 1.35;
      display: none;
    }

    .zs-select {
      width: 100%;
      padding: 5px 8px;
      background: #1e2029;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 5px;
      color: #fff;
      font-size: 11px;
      outline: none;
      cursor: pointer;
    }

    .zs-btn-row {
      display: flex;
      gap: 5px;
    }

    .zs-btn {
      flex: 1;
      padding: 6px 8px;
      border-radius: 5px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.06);
      color: #f3f4f6;
      font-size: 10.5px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: all 0.12s;
    }
    .zs-btn:hover {
      background: rgba(255, 255, 255, 0.12);
    }
    .zs-btn.primary {
      background: #4f46e5;
      border-color: #6366f1;
      color: #fff;
    }
    .zs-btn.primary:hover {
      background: #4338ca;
    }
    .zs-btn.stop {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.35);
      color: #f87171;
    }
    .zs-btn.stop:hover {
      background: rgba(239, 68, 68, 0.25);
    }
  `;

  function init() {
    if (document.getElementById("zs-floating-root")) return;

    const styleEl = document.createElement("style");
    styleEl.textContent = STYLES;
    (document.head || document.documentElement).appendChild(styleEl);

    rootContainer = document.createElement("div");
    rootContainer.id = "zs-floating-root";

    rootContainer.innerHTML = `
      <div id="zs-floating-panel">
        <div class="zs-panel-header">
          <div class="zs-panel-title">
            <span id="zs-panel-dot" class="zs-dot danger"></span>
            <span>Devil-X Control</span>
          </div>
          <button id="zs-panel-close" class="zs-close-btn" title="Close">×</button>
        </div>

        <div class="zs-status-box">
          <div class="zs-row">
            <span class="zs-muted">Agent Status:</span>
            <span id="zs-status-bridge" class="zs-badge danger">Offline</span>
          </div>
          <div class="zs-row">
            <span class="zs-muted">Current AI:</span>
            <span id="zs-status-ai" class="zs-badge">Detecting…</span>
          </div>
          <div class="zs-row">
            <span class="zs-muted">Current Target:</span>
            <span id="zs-status-target" class="zs-badge">Roblox Studio</span>
          </div>
        </div>

        <div id="zs-notice" class="zs-notice"></div>

        <div>
          <div class="zs-muted" style="font-size:10px;margin-bottom:3px;">Target Selector</div>
          <select id="zs-target-select" class="zs-select">
            <option value="visual_studio">Microsoft Visual Studio (C# / C++)</option>
            <option value="vscode">VS Code</option>
            <option value="unity">Unity Editor</option>
            <option value="android_studio">Android Studio</option>
            <option value="roblox">Roblox Studio</option>
          </select>
        </div>

        <div class="zs-btn-row">
          <button id="zs-btn-start-stop" class="zs-btn primary">Start Agent</button>
          <button id="zs-btn-reconnect" class="zs-btn">↻ Reconnect</button>
        </div>

        <button id="zs-btn-stop-all" class="zs-btn stop" style="width:100%;">🛑 Stop All</button>
      </div>

      <div id="zs-floating-btn" title="Devil-X AI-to-Software Control">
        <span id="zs-btn-dot" class="zs-dot danger"></span>
        <span class="zs-btn-label">Devil-X</span>
        <span id="zs-btn-target-pill" class="zs-target-pill">Roblox</span>
      </div>
    `;

    (document.body || document.documentElement).appendChild(rootContainer);
    bindEvents();
    queryStatus();
  }

  function bindEvents() {
    const btn = document.getElementById("zs-floating-btn");
    const panel = document.getElementById("zs-floating-panel");
    const closeBtn = document.getElementById("zs-panel-close");
    const startStopBtn = document.getElementById("zs-btn-start-stop");
    const reconnectBtn = document.getElementById("zs-btn-reconnect");
    const stopAllBtn = document.getElementById("zs-btn-stop-all");
    const targetSelect = document.getElementById("zs-target-select");

    // Dragging support
    let isDragging = false;
    let startX, startY, initialX, initialY;

    btn.addEventListener("mousedown", (e) => {
      // Only drag with left click
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = rootContainer.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      rootContainer.style.bottom = "auto";
      rootContainer.style.right = "auto";
      rootContainer.style.left = `${initialX}px`;
      rootContainer.style.top = `${initialY}px`;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      rootContainer.style.left = `${initialX + dx}px`;
      rootContainer.style.top = `${initialY + dy}px`;
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });

    btn?.addEventListener("click", (e) => {
      // Ignore click if it was a drag
      if (Math.abs(e.clientX - (startX || 0)) > 4 || Math.abs(e.clientY - (startY || 0)) > 4) {
        return;
      }
      e.stopPropagation();
      panelOpen = !panelOpen;
      panel.style.display = panelOpen ? "flex" : "none";
      if (panelOpen) queryStatus();
    });

    closeBtn?.addEventListener("click", () => {
      panelOpen = false;
      panel.style.display = "none";
    });

    document.addEventListener("click", (e) => {
      if (panelOpen && !rootContainer.contains(e.target)) {
        panelOpen = false;
        panel.style.display = "none";
      }
    });

    startStopBtn?.addEventListener("click", () => {
      const notice = document.getElementById("zs-notice");
      if (isConnected) {
        startStopBtn.textContent = "Stopping…";
        startStopBtn.disabled = true;
        chrome.runtime.sendMessage({ type: "stop_agent" }, () => {
          setTimeout(queryStatus, 800);
        });
      } else {
        startStopBtn.textContent = "Starting Bridge…";
        startStopBtn.disabled = true;
        chrome.runtime.sendMessage({ type: "start_agent" }, (resp) => {
          if (resp && resp.ok === false) {
            if (notice) {
              notice.style.display = "block";
              notice.textContent = resp.error || "Please run start.bat on your PC to launch Devil-X.";
            }
          }
          setTimeout(queryStatus, 1500);
        });
      }
    });

    reconnectBtn?.addEventListener("click", () => {
      reconnectBtn.textContent = "…";
      reconnectBtn.disabled = true;
      chrome.runtime.sendMessage({ type: "reconnect" }, () => {
        setTimeout(() => {
          reconnectBtn.textContent = "↻ Reconnect";
          reconnectBtn.disabled = false;
          queryStatus();
        }, 700);
      });
    });

    stopAllBtn?.addEventListener("click", () => {
      stopAllBtn.disabled = true;
      chrome.runtime.sendMessage({ type: "emergency_stop_all" });
      stopAllBtn.textContent = "🛑 Halted!";
      setTimeout(() => {
        stopAllBtn.textContent = "🛑 Stop All";
        stopAllBtn.disabled = false;
        queryStatus();
      }, 1200);
    });

    targetSelect?.addEventListener("change", (e) => {
      const cid = e.target.value;
      chrome.runtime.sendMessage({ type: "set_active_connector", connector_id: cid }, () => {
        queryStatus();
      });
    });
  }

  function updateUI(status) {
    if (!status) return;
    isConnected = !!status.connected;
    const connState = status.connectionState || (isConnected ? "connected" : "disconnected");

    const btnDot = document.getElementById("zs-btn-dot");
    const panelDot = document.getElementById("zs-panel-dot");
    const statusBridge = document.getElementById("zs-status-bridge");
    const statusAi = document.getElementById("zs-status-ai");
    const statusTarget = document.getElementById("zs-status-target");
    const targetSelect = document.getElementById("zs-target-select");
    const startStopBtn = document.getElementById("zs-btn-start-stop");
    const targetPill = document.getElementById("zs-btn-target-pill");
    const notice = document.getElementById("zs-notice");

    // Handle 5 connection states
    switch (connState) {
      case "connected":
        if (btnDot) btnDot.className = "zs-dot online";
        if (panelDot) panelDot.className = "zs-dot online";
        if (statusBridge) {
          statusBridge.className = "zs-badge success";
          statusBridge.textContent = "Connected";
        }
        if (startStopBtn) {
          startStopBtn.textContent = "Stop Agent";
          startStopBtn.className = "zs-btn stop";
          startStopBtn.disabled = false;
        }
        if (notice && !notice.dataset.manual) notice.style.display = "none";
        break;

      case "connecting":
        if (btnDot) btnDot.className = "zs-dot connecting";
        if (panelDot) panelDot.className = "zs-dot connecting";
        if (statusBridge) {
          statusBridge.className = "zs-badge warn";
          statusBridge.textContent = "Connecting…";
        }
        if (startStopBtn) {
          startStopBtn.textContent = "Connecting…";
          startStopBtn.className = "zs-btn";
          startStopBtn.disabled = true;
        }
        break;

      case "reconnecting":
        if (btnDot) btnDot.className = "zs-dot connecting";
        if (panelDot) panelDot.className = "zs-dot connecting";
        if (statusBridge) {
          statusBridge.className = "zs-badge warn";
          statusBridge.textContent = "Reconnecting…";
        }
        if (startStopBtn) {
          startStopBtn.textContent = "Reconnecting…";
          startStopBtn.className = "zs-btn";
          startStopBtn.disabled = false;
        }
        break;

      case "error":
        if (btnDot) btnDot.className = "zs-dot danger";
        if (panelDot) panelDot.className = "zs-dot danger";
        if (statusBridge) {
          statusBridge.className = "zs-badge danger";
          statusBridge.textContent = "Error";
        }
        if (startStopBtn) {
          startStopBtn.textContent = "Start Agent";
          startStopBtn.className = "zs-btn primary";
          startStopBtn.disabled = false;
        }
        if (notice && status.lastError) {
          notice.style.display = "block";
          notice.textContent = status.lastError;
        }
        break;

      case "disconnected":
      default:
        if (btnDot) btnDot.className = "zs-dot danger";
        if (panelDot) panelDot.className = "zs-dot danger";
        if (statusBridge) {
          statusBridge.className = "zs-badge danger";
          statusBridge.textContent = "Offline";
        }
        if (startStopBtn) {
          startStopBtn.textContent = "Start Agent";
          startStopBtn.className = "zs-btn primary";
          startStopBtn.disabled = false;
        }
        break;
    }

    // Detect AI provider from current hostname
    let aiName = "AI Chat";
    const host = window.location.hostname.toLowerCase();
    if (host.includes("deepseek")) aiName = "DeepSeek";
    else if (host.includes("chatgpt") || host.includes("openai")) aiName = "ChatGPT";
    else if (host.includes("gemini")) aiName = "Gemini";
    else if (host.includes("aistudio")) aiName = "AI Studio";
    else if (host.includes("claude")) aiName = "Claude";
    else if (host.includes("kimi")) aiName = "Kimi";
    else if (host.includes("chat.z.ai")) aiName = "GLM";
    else if (host.includes("qwen")) aiName = "Qwen";
    else if (host.includes("arena")) aiName = "Arena.ai";
    else if (host.includes("meta")) aiName = "Meta AI";

    if (statusAi) statusAi.textContent = aiName;

    // Active connector
    let activeCid = status.active_connector || "roblox";
    if (status.connectors && status.connectors.length) {
      const found = status.connectors.find((c) => c.is_active || c.id === activeCid);
      if (found) activeCid = found.id;
    }

    if (targetSelect && targetSelect.value !== activeCid) {
      targetSelect.value = activeCid;
    }

    const targetTitle = TARGET_NAMES[activeCid] || activeCid;
    if (targetPill) targetPill.textContent = targetTitle.split(" ")[0];

    if (statusTarget) {
      if (activeCid === "roblox") {
        if (isConnected && (status.mcpAlive || status.studio === true || status.studioApp === true)) {
          statusTarget.className = "zs-badge success";
          statusTarget.textContent = "Roblox [AVAILABLE]";
        } else if (isConnected) {
          statusTarget.className = "zs-badge warn";
          statusTarget.textContent = "Roblox [NOT CONNECTED]";
        } else {
          statusTarget.className = "zs-badge";
          statusTarget.textContent = "Roblox Studio";
        }
        if (notice && !notice.dataset.manual && connState !== "error") {
          notice.style.display = "none";
        }
      } else {
        statusTarget.className = "zs-badge";
        statusTarget.textContent = `${targetTitle} [ACTIVE]`;
        if (notice && !notice.dataset.manual && connState !== "error") {
          notice.style.display = "none";
        }
      }
    }
  }

  function queryStatus() {
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: "status" }, (res) => {
        if (res) updateUI(res);
      });
    }
  }

  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === "zs-status") updateUI(msg);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { init, updateUI };
})();
