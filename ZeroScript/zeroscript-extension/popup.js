// SPDX-License-Identifier: GPL-3.0-or-later
// popup.js - ZeroScript Universal Agent Control Center Controller

(() => {
  "use strict";

  const SUPPORTED_HOSTS = [
    "chat.deepseek.com", "deepseek.com", "chatgpt.com", "chat.openai.com",
    "gemini.google.com", "aistudio.google.com", "www.kimi.ai", "kimi.ai",
    "chat.z.ai", "chat.qwen.ai", "arena.ai", "www.meta.ai", "meta.ai",
  ];

  let currentStatus = null;
  let customProviders = [];

  // ── Tab Navigation ──────────────────────────────────────────────────────────
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const targetPane = document.getElementById(target);
      if (targetPane) targetPane.classList.add("active");
    });
  });

  // Version
  try {
    const ver = chrome.runtime.getManifest().version;
    const vEl = document.getElementById("version");
    if (vEl) vEl.textContent = `v${ver}`;
  } catch {}

  // ── Status Rendering ────────────────────────────────────────────────────────
  function render(s) {
    if (!s) return;
    currentStatus = s;

    const dot = document.getElementById("bridge-dot");
    const agentBadge = document.getElementById("agent-badge");
    const bridgeStatus = document.getElementById("bridge-status");
    const activeConnBadge = document.getElementById("active-connector-badge");
    const toolsCount = document.getElementById("tools-count");

    const isConnected = !!s.connected;
    const mcpAlive = !!s.mcpAlive;
    const toolsNum = s.tools || 0;

    // Bridge Status
    if (isConnected) {
      dot.className = "brand-dot online";
      bridgeStatus.className = "badge success";
      bridgeStatus.textContent = "Connected (127.0.0.1)";
      agentBadge.className = "badge success";
      agentBadge.textContent = "Agent Ready";
    } else {
      dot.className = "brand-dot danger";
      bridgeStatus.className = "badge danger";
      bridgeStatus.textContent = "Offline";
      agentBadge.className = "badge danger";
      agentBadge.textContent = "Offline";
    }

    toolsCount.textContent = `${toolsNum} tools available`;

    // Active Connector badge
    const activeCid = (s.connectors && s.connectors.find((c) => c.is_active)?.name) || "Roblox Studio";
    activeConnBadge.textContent = activeCid;

    // Roblox Studio specifics
    const robloxCard = document.getElementById("roblox-card");
    const studioProc = document.getElementById("studio-proc-status");
    const mcpServer = document.getElementById("mcp-server-status");
    const studioPlace = document.getElementById("studio-place-status");

    if (robloxCard) {
      if (s.studioProc === true) {
        studioProc.className = "badge success";
        studioProc.textContent = "Running";
      } else if (s.studioProc === false) {
        studioProc.className = "badge danger";
        studioProc.textContent = "Closed";
      } else {
        studioProc.className = "badge";
        studioProc.textContent = "Unknown";
      }

      if (mcpAlive) {
        mcpServer.className = "badge success";
        mcpServer.textContent = "Active";
      } else {
        mcpServer.className = "badge warn";
        mcpServer.textContent = isConnected ? "Stopped" : "Offline";
      }

      if (s.studio === true) {
        studioPlace.className = "badge success";
        studioPlace.textContent = "Place Loaded";
      } else if (s.studio === false) {
        studioPlace.className = "badge warn";
        studioPlace.textContent = "No Place Open";
      } else {
        studioPlace.className = "badge";
        studioPlace.textContent = isConnected ? "Probing…" : "Unavailable";
      }
    }

    // Native Background Host controls
    const btnStart = document.getElementById("btn-start-agent");
    const btnStop = document.getElementById("btn-stop-agent");
    const btnRestart = document.getElementById("btn-restart-agent");
    const nativeHostStatus = document.getElementById("native-host-status");

    if (s.nativeHost) {
      if (nativeHostStatus) {
        nativeHostStatus.className = "badge success";
        nativeHostStatus.textContent = "Active & Registered";
      }
      if (isConnected) {
        if (btnStart) btnStart.style.display = "none";
        if (btnStop) btnStop.style.display = "inline-flex";
        if (btnRestart) btnRestart.style.display = "inline-flex";
      } else {
        if (btnStart) btnStart.style.display = "inline-flex";
        if (btnStop) btnStop.style.display = "none";
        if (btnRestart) btnRestart.style.display = "none";
      }
    } else {
      if (nativeHostStatus) {
        nativeHostStatus.className = "badge warn";
        nativeHostStatus.textContent = "Not Installed (Use start.bat)";
      }
      if (btnStart) btnStart.style.display = "none";
      if (btnStop) btnStop.style.display = "none";
      if (btnRestart) btnRestart.style.display = "none";
    }

    // Connectors list render
    renderConnectors(s.connectors || []);

    // Audit log render
    if (s.recentAudit) {
      renderAudit(s.recentAudit);
    }
  }

  // ── Render Connectors ───────────────────────────────────────────────────────
  function renderConnectors(conns) {
    const listEl = document.getElementById("connectors-list");
    if (!listEl) return;

    if (!conns || !conns.length) {
      // Fallback built-in list
      conns = [
        { id: "roblox", name: "Roblox Studio", description: "Luau scripts & place tree via MCP", is_active: true, available: true },
        { id: "vscode", name: "Visual Studio Code", description: "Workspace files & command execution", is_active: false, available: false },
        { id: "unity", name: "Unity Editor", description: "Scene objects & C# scripts", is_active: false, available: false },
        { id: "android_studio", name: "Android Studio", description: "Gradle builds & ADB commands", is_active: false, available: false },
      ];
    }

    listEl.innerHTML = "";
    conns.forEach((c) => {
      const item = document.createElement("div");
      item.className = `connector-item ${c.is_active ? "active" : ""}`;
      item.innerHTML = `
        <div class="connector-info">
          <div class="connector-name">${c.name} ${c.is_active ? '<span class="badge info" style="font-size:9px;padding:1px 4px;">ACTIVE</span>' : ""}</div>
          <div class="connector-desc">${c.description || ""}</div>
        </div>
        <div>
          <button class="btn ${c.is_active ? "btn-primary" : ""}" style="width:auto;padding:3px 8px;font-size:10px;">
            ${c.is_active ? "Selected" : "Select"}
          </button>
        </div>
      `;

      item.addEventListener("click", () => {
        if (!c.is_active) {
          chrome.runtime.sendMessage({ type: "set_active_connector", connector_id: c.id }, () => {
            refresh();
          });
        }
      });
      listEl.appendChild(item);
    });
  }

  // ── Render Audit Log ────────────────────────────────────────────────────────
  function renderAudit(items) {
    const listEl = document.getElementById("audit-list");
    if (!listEl) return;

    if (!items || !items.length) {
      listEl.innerHTML = '<div style="padding: 14px; text-align: center; color: var(--text-muted);">No commands recorded yet.</div>';
      return;
    }

    listEl.innerHTML = "";
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "audit-item";
      const isOk = item.ok !== false;
      const statusBadge = isOk
        ? `<span class="badge success">${item.durationMs ? item.durationMs + "ms" : "OK"}</span>`
        : `<span class="badge danger">${item.error || "FAIL"}</span>`;

      row.innerHTML = `
        <div>
          <div class="audit-tool">${item.tool || "command"}</div>
          <div style="color:var(--text-muted);font-size:9.5px;">${item.timeStr || new Date(item.timestamp || Date.now()).toLocaleTimeString()}</div>
        </div>
        <div class="audit-status">${statusBadge}</div>
      `;
      listEl.appendChild(row);
    });
  }

  // ── Check Active Tab for AI site detection ──────────────────────────────────
  function checkActiveTab() {
    const aiBadge = document.getElementById("detected-ai-badge");
    if (!aiBadge) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs.length || !tabs[0].url) {
        aiBadge.textContent = "No AI tab open";
        aiBadge.className = "badge";
        return;
      }
      const url = tabs[0].url.toLowerCase();
      let matchedName = null;

      if (url.includes("deepseek.com")) matchedName = "DeepSeek";
      else if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) matchedName = "ChatGPT";
      else if (url.includes("gemini.google.com")) matchedName = "Gemini";
      else if (url.includes("aistudio.google.com")) matchedName = "Google AI Studio";
      else if (url.includes("kimi.ai")) matchedName = "Kimi";
      else if (url.includes("chat.z.ai")) matchedName = "GLM (Z.ai)";
      else if (url.includes("chat.qwen.ai")) matchedName = "Qwen";
      else if (url.includes("arena.ai")) matchedName = "Arena AI";
      else if (url.includes("meta.ai")) matchedName = "Meta AI";

      // Also check custom providers
      if (!matchedName && customProviders.length) {
        for (const cp of customProviders) {
          if (cp.enabled && cp.urlPattern && url.includes(cp.urlPattern.replace(/\/\*.*$/, "").replace(/^https?:\/\//, ""))) {
            matchedName = cp.name;
            break;
          }
        }
      }

      if (matchedName) {
        aiBadge.textContent = matchedName;
        aiBadge.className = "badge info";
      } else {
        aiBadge.textContent = "Non-AI page";
        aiBadge.className = "badge";
      }
    });
  }

  // ── Refresh & Polling ───────────────────────────────────────────────────────
  function refresh() {
    chrome.runtime.sendMessage({ type: "status" }, (s) => {
      if (s) render(s);
    });
    chrome.runtime.sendMessage({ type: "get_audit_log" }, (res) => {
      if (res && res.auditLog) renderAudit(res.auditLog);
    });
    checkActiveTab();
  }

  // ── Button Event Listeners ──────────────────────────────────────────────────
  document.getElementById("btn-reconnect")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "reconnect" }, () => setTimeout(refresh, 500));
  });

  document.getElementById("btn-emergency-stop")?.addEventListener("click", () => {
    const btn = document.getElementById("btn-emergency-stop");
    if (btn) btn.textContent = "Stopping…";
    chrome.runtime.sendMessage({ type: "emergency_stop_all" }, () => {
      setTimeout(() => {
        if (btn) btn.textContent = "🛑 Stop All";
        refresh();
      }, 500);
    });
  });

  document.getElementById("btn-start-agent")?.addEventListener("click", () => {
    const btn = document.getElementById("btn-start-agent");
    if (btn) btn.textContent = "Starting Bridge…";
    chrome.runtime.sendMessage({ type: "start_agent" }, () => {
      setTimeout(refresh, 1800);
    });
  });

  document.getElementById("btn-stop-agent")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "stop_agent" }, () => {
      setTimeout(refresh, 800);
    });
  });

  document.getElementById("btn-restart-agent")?.addEventListener("click", () => {
    const btn = document.getElementById("btn-restart-agent");
    if (btn) btn.textContent = "Restarting…";
    chrome.runtime.sendMessage({ type: "restart_agent" }, () => {
      setTimeout(refresh, 2200);
    });
  });

  document.getElementById("btn-clear-audit")?.addEventListener("click", () => {
    renderAudit([]);
  });

  // ── Phase 4: Provider Builder UI ───────────────────────────────────────────
  const builderPanel = document.getElementById("builder-panel");
  const btnShowBuilder = document.getElementById("btn-show-builder");
  const btnCancelBuilder = document.getElementById("btn-cancel-builder");
  const btnRunDiscovery = document.getElementById("btn-run-discovery");
  const builderSelectors = document.getElementById("builder-selectors");
  const builderUrlInput = document.getElementById("builder-url");
  const btnTestProvider = document.getElementById("btn-test-provider");
  const btnSaveProvider = document.getElementById("btn-save-provider");
  const testRes = document.getElementById("builder-test-res");

  btnShowBuilder?.addEventListener("click", () => {
    builderPanel.style.display = "block";
    builderSelectors.style.display = "none";
    if (testRes) testRes.textContent = "";

    // Pre-fill with active tab URL if available
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].url && tabs[0].url.startsWith("http")) {
        builderUrlInput.value = tabs[0].url;
      }
    });
  });

  btnCancelBuilder?.addEventListener("click", () => {
    builderPanel.style.display = "none";
  });

  // Load Custom Providers from Storage
  function loadCustomProviders() {
    chrome.storage.local.get(["custom_providers"], (res) => {
      customProviders = res.custom_providers || [];
      renderCustomProviders();
    });
  }

  function renderCustomProviders() {
    const listEl = document.getElementById("custom-providers-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    if (!customProviders.length) {
      listEl.innerHTML = '<div style="color:var(--text-muted);padding:8px 0;font-size:11px;">No custom AI websites added yet.</div>';
      return;
    }

    customProviders.forEach((cp, idx) => {
      const item = document.createElement("div");
      item.className = "custom-provider-item";
      item.innerHTML = `
        <div>
          <div style="font-weight:500;">${cp.name}</div>
          <div style="color:var(--text-muted);font-size:10px;">${cp.urlPattern}</div>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-danger" style="width:auto;padding:2px 6px;font-size:10px;" data-del="${idx}">Delete</button>
        </div>
      `;
      item.querySelector(`[data-del="${idx}"]`)?.addEventListener("click", () => {
        customProviders.splice(idx, 1);
        chrome.storage.local.set({ custom_providers: customProviders }, () => {
          renderCustomProviders();
        });
      });
      listEl.appendChild(item);
    });
  }

  btnRunDiscovery?.addEventListener("click", () => {
    const url = (builderUrlInput.value || "").trim();
    if (!url) {
      alert("Please enter a valid website URL");
      return;
    }

    btnRunDiscovery.textContent = "Analyzing…";

    // Attempt to analyze active tab DOM
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0];
      if (activeTab && activeTab.url && activeTab.url.includes(new URL(url).hostname)) {
        // Execute discovery script on tab
        chrome.scripting.executeScript(
          {
            target: { tabId: activeTab.id },
            func: () => {
              if (typeof ZSDetector !== "undefined") {
                return ZSDetector.discover(document, window.location.href);
              }
              return null;
            },
          },
          (results) => {
            btnRunDiscovery.textContent = "🔍 Discover Selectors";
            const res = results && results[0] && results[0].result;
            populateBuilderForm(res, url);
          }
        );
      } else {
        // Tab not open; generate standard semantic template
        btnRunDiscovery.textContent = "🔍 Discover Selectors";
        populateBuilderForm(null, url);
      }
    });
  });

  function populateBuilderForm(discovery, url) {
    builderSelectors.style.display = "block";
    let hostname = "Custom AI";
    try { hostname = new URL(url).hostname.replace(/^www\./, ""); } catch {}

    document.getElementById("sel-name").value = (discovery && discovery.name) || hostname;
    document.getElementById("sel-editor").value = (discovery && discovery.selectors && discovery.selectors.editor) || "textarea, [contenteditable='true']";
    document.getElementById("sel-send").value = (discovery && discovery.selectors && discovery.selectors.sendBtn) || "button[type='submit'], button[aria-label*='Send' i]";
    document.getElementById("sel-stop").value = (discovery && discovery.selectors && discovery.selectors.stopBtn) || "button[aria-label*='Stop' i]";
    document.getElementById("sel-turn").value = (discovery && discovery.selectors && discovery.selectors.chatItem) || "[role='article'], .message, .chat-message";

    if (testRes) testRes.innerHTML = `<span style="color:#34d399;">✓ Selectors auto-generated. Test them on the live page or adjust below.</span>`;
  }

  btnTestProvider?.addEventListener("click", () => {
    const config = {
      selectors: {
        editor: document.getElementById("sel-editor").value.trim(),
        sendBtn: document.getElementById("sel-send").value.trim(),
        stopBtn: document.getElementById("sel-stop").value.trim(),
        chatItem: document.getElementById("sel-turn").value.trim(),
      },
    };

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0];
      if (!activeTab) return;

      chrome.scripting.executeScript(
        {
          target: { tabId: activeTab.id },
          func: (cfg) => {
            const checks = {
              editor: !!document.querySelector(cfg.selectors.editor),
              sendBtn: !!document.querySelector(cfg.selectors.sendBtn),
              chatItem: !!document.querySelector(cfg.selectors.chatItem),
            };
            return checks;
          },
          args: [config],
        },
        (results) => {
          const checks = results && results[0] && results[0].result;
          if (checks) {
            const ed = checks.editor ? "✓ Input Found" : "✗ Input Not Found";
            const btn = checks.sendBtn ? "✓ Send Btn Found" : "✗ Send Btn Missing";
            const turn = checks.chatItem ? "✓ Messages Found" : "✗ Messages Missing";
            testRes.innerHTML = `<span style="color:#e8e8ec;">Test: ${ed} | ${btn} | ${turn}</span>`;
          } else {
            testRes.innerHTML = `<span style="color:#fbbf24;">Ensure the target AI site tab is active to run live tests.</span>`;
          }
        }
      );
    });
  });

  btnSaveProvider?.addEventListener("click", () => {
    const name = document.getElementById("sel-name").value.trim() || "Custom AI";
    const url = builderUrlInput.value.trim();
    let pattern = "*://*/*";
    try {
      const u = new URL(url);
      pattern = `${u.protocol}//${u.hostname}/*`;
    } catch {}

    const newProvider = {
      id: "custom_" + Date.now().toString(36),
      name,
      urlPattern: pattern,
      enabled: true,
      selectors: {
        editor: document.getElementById("sel-editor").value.trim(),
        sendBtn: document.getElementById("sel-send").value.trim(),
        stopBtn: document.getElementById("sel-stop").value.trim(),
        chatItem: document.getElementById("sel-turn").value.trim(),
        box: ".markdown, .prose",
      },
      createdAt: Date.now(),
    };

    customProviders.push(newProvider);
    chrome.storage.local.set({ custom_providers: customProviders }, () => {
      builderPanel.style.display = "none";
      renderCustomProviders();
      alert(`AI Website '${name}' saved and enabled!`);
    });
  });

  // Init
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "zs-status") render(msg);
  });

  loadCustomProviders();
  refresh();
  setInterval(refresh, 2500);
})();
