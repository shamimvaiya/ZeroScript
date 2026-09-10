// SPDX-License-Identifier: GPL-3.0-or-later
// popup.js - Devil-X Lightweight Extension Popup Controller

(() => {
  "use strict";

  const PROVIDER_NAMES = {
    chatgpt: "ChatGPT",
    gemini: "Gemini",
    deepseek: "DeepSeek",
    aistudio: "Google AI Studio",
    claude: "Claude",
    kimi: "Kimi",
    glm: "GLM (Z.ai)",
    qwen: "Qwen",
    arena: "Arena.ai",
    meta: "Meta AI",
    local_ollama: "Local AI (Ollama)",
    local_openai: "Local AI (LM Studio)",
  };

  const TARGET_NAMES = {
    roblox: "Roblox Studio",
    vscode: "Visual Studio Code",
    unity: "Unity Editor",
    android_studio: "Android Studio",
  };

  const TARGET_STATUSES = {
    roblox: "AVAILABLE",
    vscode: "AVAILABLE",
    unity: "NOT IMPLEMENTED",
    android_studio: "NOT IMPLEMENTED",
  };

  let isConnected = false;
  let hasNativeHost = false;
  let currentConnectionState = "disconnected";
  let activeEditingProviderId = null;

  // DOM Elements
  const bridgeDot = document.getElementById("bridge-dot");
  const agentStatusVal = document.getElementById("agent-status-val");
  const aiStatusVal = document.getElementById("ai-status-val");
  const targetStatusVal = document.getElementById("target-status-val");
  const targetImplBadge = document.getElementById("target-impl-badge");
  const agentNotice = document.getElementById("agent-notice");
  const targetNote = document.getElementById("target-note");
  const btnToggleAgent = document.getElementById("btn-toggle-agent");
  const targetSelect = document.getElementById("target-select");
  const providerSelect = document.getElementById("provider-select");
  const btnReconnect = document.getElementById("btn-reconnect");
  const btnEmergencyStop = document.getElementById("btn-emergency-stop");
  const btnToggleSettings = document.getElementById("btn-toggle-settings");
  const settingsPanel = document.getElementById("settings-panel");
  const settingsArrow = document.getElementById("settings-arrow");
  const nativeHostStatus = document.getElementById("native-host-status");
  const activeConnectorStatus = document.getElementById("active-connector-status");
  const connectorStatusBadge = document.getElementById("connector-status-badge");
  const mcpServerStatus = document.getElementById("mcp-server-status");
  const studioPlaceStatus = document.getElementById("studio-place-status");

  // Local AI Elements
  const localAiUrlInput = document.getElementById("local-ai-url");
  const localAiModelInput = document.getElementById("local-ai-model");
  const btnTestLocalAi = document.getElementById("btn-test-local-ai");
  const localAiStatusBadge = document.getElementById("local-ai-status-badge");

  // Provider Builder Elements
  const btnOpenProviderBuilder = document.getElementById("btn-open-provider-builder");
  const providerBuilderModal = document.getElementById("provider-builder-modal");
  const pbBtnClose = document.getElementById("pb-btn-close");
  const pbUrlInput = document.getElementById("pb-url");
  const pbBtnDiscover = document.getElementById("pb-btn-discover");
  const pbNameInput = document.getElementById("pb-name");
  const pbPatternInput = document.getElementById("pb-pattern");
  const pbSelEditor = document.getElementById("pb-sel-editor");
  const pbSelSend = document.getElementById("pb-sel-send");
  const pbSelStop = document.getElementById("pb-sel-stop");
  const pbSelChat = document.getElementById("pb-sel-chat");
  const pbSelBox = document.getElementById("pb-sel-box");
  const pbSelCode = document.getElementById("pb-sel-code");
  const pbBtnTestInput = document.getElementById("pb-btn-test-input");
  const pbBtnTestSend = document.getElementById("pb-btn-test-send");
  const pbBtnTestResp = document.getElementById("pb-btn-test-resp");
  const pbBtnTestCode = document.getElementById("pb-btn-test-code");
  const pbTestStatus = document.getElementById("pb-test-status");
  const pbBtnSave = document.getElementById("pb-btn-save");
  const pbBtnCancel = document.getElementById("pb-btn-cancel");
  const pbCustomList = document.getElementById("pb-custom-list");

  // Version
  try {
    const ver = chrome.runtime.getManifest().version;
    const vEl = document.getElementById("version");
    if (vEl) vEl.textContent = `v${ver}`;
  } catch {}

  // ── Render Status ───────────────────────────────────────────────────────────
  function render(s) {
    if (!s) return;
    isConnected = !!s.connected;
    hasNativeHost = !!s.nativeHost;
    currentConnectionState = s.connectionState || (isConnected ? "connected" : "disconnected");

    // Agent Connection States
    switch (currentConnectionState) {
      case "connected":
        if (bridgeDot) bridgeDot.className = "status-dot online";
        if (agentStatusVal) {
          agentStatusVal.className = "status-val online";
          agentStatusVal.textContent = "● Connected";
        }
        if (btnToggleAgent) {
          btnToggleAgent.textContent = "Stop Agent";
          btnToggleAgent.className = "btn btn-danger";
          btnToggleAgent.disabled = false;
        }
        if (agentNotice) agentNotice.style.display = "none";
        break;

      case "connecting":
        if (bridgeDot) bridgeDot.className = "status-dot connecting";
        if (agentStatusVal) {
          agentStatusVal.className = "status-val connecting";
          agentStatusVal.textContent = "● Connecting…";
        }
        if (btnToggleAgent) {
          btnToggleAgent.textContent = "Connecting…";
          btnToggleAgent.className = "btn btn-secondary";
          btnToggleAgent.disabled = true;
        }
        break;

      case "reconnecting":
        if (bridgeDot) bridgeDot.className = "status-dot connecting";
        if (agentStatusVal) {
          agentStatusVal.className = "status-val connecting";
          agentStatusVal.textContent = "● Reconnecting…";
        }
        if (btnToggleAgent) {
          btnToggleAgent.textContent = "Reconnecting…";
          btnToggleAgent.className = "btn btn-secondary";
          btnToggleAgent.disabled = false;
        }
        break;

      case "error":
        if (bridgeDot) bridgeDot.className = "status-dot danger";
        if (agentStatusVal) {
          agentStatusVal.className = "status-val danger";
          agentStatusVal.textContent = "● Connection Error";
        }
        if (btnToggleAgent) {
          btnToggleAgent.textContent = "Start Agent";
          btnToggleAgent.className = "btn btn-primary";
          btnToggleAgent.disabled = false;
        }
        if (agentNotice && s.lastError) {
          agentNotice.style.display = "block";
          agentNotice.textContent = s.lastError;
        }
        break;

      case "disconnected":
      default:
        if (bridgeDot) bridgeDot.className = "status-dot danger";
        if (agentStatusVal) {
          agentStatusVal.className = "status-val danger";
          agentStatusVal.textContent = "● Disconnected";
        }
        if (btnToggleAgent) {
          btnToggleAgent.textContent = "Start Agent";
          btnToggleAgent.className = "btn btn-primary";
          btnToggleAgent.disabled = false;
        }
        break;
    }

    // Active Target Connector
    let activeCid = s.active_connector || "roblox";
    if (s.connectors && s.connectors.length) {
      const found = s.connectors.find((c) => c.is_active || c.id === activeCid);
      if (found) activeCid = found.id;
    }
    if (targetSelect && targetSelect.value !== activeCid) {
      targetSelect.value = activeCid;
    }
    if (targetStatusVal) {
      targetStatusVal.textContent = TARGET_NAMES[activeCid] || activeCid;
    }

    // Update target implementation badge and notes
    updateTargetBadge(activeCid, s);

    // Settings details
    if (activeConnectorStatus) {
      activeConnectorStatus.textContent = TARGET_NAMES[activeCid] || activeCid;
    }
    if (connectorStatusBadge && targetImplBadge) {
      connectorStatusBadge.textContent = targetImplBadge.textContent;
      connectorStatusBadge.className = targetImplBadge.className;
    }

    if (nativeHostStatus) {
      if (s.nativeHost) {
        nativeHostStatus.className = "badge success";
        nativeHostStatus.textContent = "Active";
      } else {
        nativeHostStatus.className = "badge warn";
        nativeHostStatus.textContent = "Not Installed (start.bat)";
      }
    }

    if (mcpServerStatus) {
      if (s.mcpAlive) {
        mcpServerStatus.className = "badge success";
        mcpServerStatus.textContent = "Active";
      } else {
        mcpServerStatus.className = "badge danger";
        mcpServerStatus.textContent = isConnected ? "Stopped" : "Offline";
      }
    }

    if (studioPlaceStatus) {
      if (s.studio === true) {
        studioPlaceStatus.className = "badge success";
        studioPlaceStatus.textContent = "Place Loaded";
      } else if (s.studio === false) {
        studioPlaceStatus.className = "badge warn";
        studioPlaceStatus.textContent = "No Place Open";
      } else {
        studioPlaceStatus.className = "badge";
        studioPlaceStatus.textContent = isConnected ? "Probing…" : "Unknown";
      }
    }
  }

  function updateTargetBadge(cid, s) {
    if (!targetImplBadge) return;

    if (cid === "roblox" || cid === "vscode") {
      targetImplBadge.className = "badge success";
      targetImplBadge.textContent = "AVAILABLE";

      if (targetNote) {
        if (cid === "vscode") {
          targetNote.style.display = "block";
          targetNote.textContent = "VS Code connector active: Safe workspace file reading, editing, and restricted terminal command execution.";
        } else {
          targetNote.style.display = "none";
        }
      }
    } else {
      targetImplBadge.className = "badge warn";
      targetImplBadge.textContent = "NOT IMPLEMENTED";
      if (targetNote) {
        targetNote.style.display = "block";
        targetNote.textContent = `${TARGET_NAMES[cid] || cid} connector is NOT IMPLEMENTED yet. Roblox Studio and Visual Studio Code are the working connectors.`;
      }
    }
  }

  // ── Detect AI site on active browser tab ─────────────────────────────────────
  function checkActiveTab() {
    if (!aiStatusVal) return;
    if (!chrome.tabs || !chrome.tabs.query) {
      aiStatusVal.textContent = "ChatGPT";
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs.length || !tabs[0].url) {
        aiStatusVal.textContent = "No AI tab open";
        return;
      }
      const url = tabs[0].url.toLowerCase();
      let matchedKey = null;

      if (url.includes("deepseek.com")) matchedKey = "deepseek";
      else if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) matchedKey = "chatgpt";
      else if (url.includes("gemini.google.com")) matchedKey = "gemini";
      else if (url.includes("aistudio.google.com")) matchedKey = "aistudio";
      else if (url.includes("claude.ai")) matchedKey = "claude";
      else if (url.includes("kimi.ai")) matchedKey = "kimi";
      else if (url.includes("chat.z.ai")) matchedKey = "glm";
      else if (url.includes("chat.qwen.ai")) matchedKey = "qwen";
      else if (url.includes("arena.ai")) matchedKey = "arena";
      else if (url.includes("meta.ai")) matchedKey = "meta";

      if (matchedKey) {
        aiStatusVal.textContent = PROVIDER_NAMES[matchedKey];
        if (providerSelect) providerSelect.value = matchedKey;
      } else {
        const selVal = providerSelect ? providerSelect.value : "chatgpt";
        aiStatusVal.textContent = `${PROVIDER_NAMES[selVal] || selVal} (Target)`;
      }

      // Pre-fill Provider Builder URL input if tab active
      if (pbUrlInput && !pbUrlInput.value && tabs[0].url.startsWith("http")) {
        pbUrlInput.value = tabs[0].url;
      }
    });
  }

  // ── Custom Provider List Rendering ──────────────────────────────────────────
  function loadCustomProviders() {
    chrome.runtime.sendMessage({ type: "get_custom_providers" }, (res) => {
      if (!res || !res.providers) return;
      renderCustomProvidersList(res.providers);
      updateProviderSelectDropdown(res.providers);
    });
  }

  function renderCustomProvidersList(providers) {
    if (!pbCustomList) return;
    pbCustomList.innerHTML = "";

    if (!providers || !providers.length) {
      pbCustomList.innerHTML = '<div style="font-size:10px; color:#888;">No custom AI websites saved yet.</div>';
      return;
    }

    providers.forEach((p) => {
      const div = document.createElement("div");
      div.className = "custom-provider-item";
      div.innerHTML = `
        <div>
          <strong>${p.name || p.id}</strong>
          <div style="font-size:9px; color:#aaa;">${p.urlPattern || ""}</div>
        </div>
        <div class="cp-actions">
          <button class="btn btn-sm btn-secondary cp-btn-edit" data-id="${p.id}">Edit</button>
          <button class="btn btn-sm btn-danger cp-btn-del" data-id="${p.id}">Delete</button>
        </div>
      `;
      pbCustomList.appendChild(div);
    });

    pbCustomList.querySelectorAll(".cp-btn-edit").forEach((btn) => {
      btn.addEventListener("click", () => editCustomProvider(btn.dataset.id, providers));
    });

    pbCustomList.querySelectorAll(".cp-btn-del").forEach((btn) => {
      btn.addEventListener("click", () => deleteCustomProvider(btn.dataset.id));
    });
  }

  function updateProviderSelectDropdown(customProviders) {
    if (!providerSelect) return;
    // Remove old custom options
    Array.from(providerSelect.options).forEach((opt) => {
      if (opt.value.startsWith("custom_")) providerSelect.remove(opt.index);
    });

    if (customProviders && customProviders.length) {
      customProviders.forEach((p) => {
        if (p.enabled !== false) {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = `${p.name || p.id} (Custom AI)`;
          providerSelect.appendChild(opt);
          PROVIDER_NAMES[p.id] = p.name || p.id;
        }
      });
    }
  }

  function editCustomProvider(id, providers) {
    const p = providers.find((x) => x.id === id);
    if (!p) return;
    activeEditingProviderId = id;
    if (pbNameInput) pbNameInput.value = p.name || "";
    if (pbPatternInput) pbPatternInput.value = p.urlPattern || "";
    if (pbSelEditor) pbSelEditor.value = p.selectors?.editor || "";
    if (pbSelSend) pbSelSend.value = p.selectors?.sendBtn || "";
    if (pbSelStop) pbSelStop.value = p.selectors?.stopBtn || "";
    if (pbSelChat) pbSelChat.value = p.selectors?.chatItem || "";
    if (pbSelBox) pbSelBox.value = p.selectors?.box || "";
    if (pbSelCode) pbSelCode.value = p.selectors?.codeBlock || "";
    if (pbTestStatus) pbTestStatus.textContent = `Editing provider '${p.name}'. Review selectors and save.`;
  }

  function deleteCustomProvider(id) {
    chrome.runtime.sendMessage({ type: "delete_custom_provider", id }, () => {
      loadCustomProviders();
    });
  }

  // ── Provider Selector Test Helpers ──────────────────────────────────────────
  function getPBConfig() {
    return {
      editor: pbSelEditor?.value || "",
      sendBtn: pbSelSend?.value || "",
      stopBtn: pbSelStop?.value || "",
      chatItem: pbSelChat?.value || "",
      box: pbSelBox?.value || "",
      codeBlock: pbSelCode?.value || "",
    };
  }

  function runPBTest(selectorType) {
    if (pbTestStatus) pbTestStatus.textContent = `Testing '${selectorType}' on active tab…`;
    chrome.runtime.sendMessage(
      { type: "test_provider_selector", selectorType, config: getPBConfig() },
      (res) => {
        if (pbTestStatus) {
          if (res && res.ok) {
            pbTestStatus.textContent = `✓ [PASS] ${res.message}`;
            pbTestStatus.style.color = "#34d399";
          } else {
            pbTestStatus.textContent = `✗ [FAIL] ${res ? res.message || res.error : "No response"}`;
            pbTestStatus.style.color = "#f87171";
          }
        }
      }
    );
  }

  // ── Refresh ─────────────────────────────────────────────────────────────────
  function refresh() {
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: "status" }, (s) => {
        if (s) render(s);
      });
    }
    checkActiveTab();
    loadCustomProviders();
  }

  // ── Event Handlers ──────────────────────────────────────────────────────────

  // Start / Stop Agent Toggle
  btnToggleAgent?.addEventListener("click", () => {
    if (isConnected) {
      btnToggleAgent.textContent = "Stopping…";
      btnToggleAgent.disabled = true;
      chrome.runtime.sendMessage({ type: "stop_agent" }, () => {
        setTimeout(refresh, 800);
      });
    } else {
      btnToggleAgent.textContent = "Starting Bridge…";
      btnToggleAgent.disabled = true;
      chrome.runtime.sendMessage({ type: "start_agent" }, (resp) => {
        if (resp && resp.ok === false) {
          if (agentNotice) {
            agentNotice.style.display = "block";
            agentNotice.textContent = resp.error || "Please run start.bat on your PC to launch Devil-X.";
          }
        }
        setTimeout(refresh, 1500);
      });
    }
  });

  // Target Software Selector
  targetSelect?.addEventListener("change", (e) => {
    const targetId = e.target.value;
    if (targetStatusVal) targetStatusVal.textContent = TARGET_NAMES[targetId] || targetId;
    updateTargetBadge(targetId, { connected: isConnected });
    chrome.runtime.sendMessage({ type: "set_active_connector", connector_id: targetId }, () => {
      refresh();
    });
  });

  // AI Provider Selector
  providerSelect?.addEventListener("change", (e) => {
    const provId = e.target.value;
    if (aiStatusVal) aiStatusVal.textContent = PROVIDER_NAMES[provId] || provId;
  });

  // Reconnect Button
  btnReconnect?.addEventListener("click", () => {
    btnReconnect.textContent = "Connecting…";
    btnReconnect.disabled = true;
    chrome.runtime.sendMessage({ type: "reconnect" }, () => {
      setTimeout(() => {
        btnReconnect.textContent = "↻ Reconnect";
        btnReconnect.disabled = false;
        refresh();
      }, 700);
    });
  });

  // Emergency Stop All
  btnEmergencyStop?.addEventListener("click", () => {
    btnEmergencyStop.textContent = "Stopping…";
    btnEmergencyStop.disabled = true;
    chrome.runtime.sendMessage({ type: "emergency_stop_all" }, () => {
      btnEmergencyStop.textContent = "🛑 Halted!";
      setTimeout(() => {
        btnEmergencyStop.textContent = "🛑 Stop All";
        btnEmergencyStop.disabled = false;
        refresh();
      }, 1000);
    });
  });

  // Toggle Settings Panel
  btnToggleSettings?.addEventListener("click", () => {
    const isOpen = settingsPanel.style.display !== "none";
    settingsPanel.style.display = isOpen ? "none" : "flex";
    settingsArrow.textContent = isOpen ? "▾" : "▴";
  });

  // Test Local AI Endpoint
  btnTestLocalAi?.addEventListener("click", () => {
    const provider = providerSelect?.value.includes("openai") ? "openai_compatible" : "ollama";
    const base_url = localAiUrlInput?.value.trim() || (provider === "ollama" ? "http://127.0.0.1:11434" : "http://127.0.0.1:1234/v1");
    const model = localAiModelInput?.value.trim() || "";

    if (localAiStatusBadge) {
      localAiStatusBadge.className = "badge warn";
      localAiStatusBadge.textContent = "Testing…";
    }

    chrome.runtime.sendMessage({ type: "check_local_ai", provider, base_url, model }, (res) => {
      if (localAiStatusBadge) {
        if (res && res.ok) {
          const count = res.models ? res.models.length : 0;
          localAiStatusBadge.className = "badge success";
          localAiStatusBadge.textContent = `Online (${count} model${count === 1 ? "" : "s"})`;
        } else {
          localAiStatusBadge.className = "badge danger";
          localAiStatusBadge.textContent = "Offline (Check URL)";
        }
      }
    });
  });

  // Open Provider Builder
  btnOpenProviderBuilder?.addEventListener("click", () => {
    if (providerBuilderModal) providerBuilderModal.style.display = "flex";
    activeEditingProviderId = null;
    loadCustomProviders();
  });

  // Close Provider Builder Modal
  pbBtnClose?.addEventListener("click", () => {
    if (providerBuilderModal) providerBuilderModal.style.display = "none";
  });
  pbBtnCancel?.addEventListener("click", () => {
    if (providerBuilderModal) providerBuilderModal.style.display = "none";
  });

  // Auto-Discover Elements on Active Tab
  pbBtnDiscover?.addEventListener("click", () => {
    if (pbTestStatus) pbTestStatus.textContent = "Auto-detecting elements on active tab…";
    chrome.runtime.sendMessage({ type: "test_provider_selector", selectorType: "discover" }, (res) => {
      if (res && res.ok && res.detected) {
        const d = res.detected;
        if (pbSelEditor && d.editor) pbSelEditor.value = d.editor;
        if (pbSelSend && d.sendBtn) pbSelSend.value = d.sendBtn;
        if (pbSelStop && d.stopBtn) pbSelStop.value = d.stopBtn;
        if (pbSelChat && d.chatItem) pbSelChat.value = d.chatItem;
        if (pbSelBox && d.box) pbSelBox.value = d.box;
        if (pbSelCode && d.codeBlock) pbSelCode.value = d.codeBlock;

        if (pbNameInput && !pbNameInput.value && pbUrlInput && pbUrlInput.value) {
          try {
            const host = new URL(pbUrlInput.value).hostname.replace("www.", "");
            pbNameInput.value = host.charAt(0).toUpperCase() + host.slice(1);
            pbPatternInput.value = `https://${host}/*`;
          } catch {}
        }

        if (pbTestStatus) {
          pbTestStatus.textContent = "✓ Auto-discovery complete! Review and test the detected selectors below.";
          pbTestStatus.style.color = "#34d399";
        }
      } else {
        if (pbTestStatus) {
          pbTestStatus.textContent = `✗ Auto-discovery failed: ${res ? res.error || res.message : "No tab response"}`;
          pbTestStatus.style.color = "#f87171";
        }
      }
    });
  });

  // Test Buttons
  pbBtnTestInput?.addEventListener("click", () => runPBTest("test_input"));
  pbBtnTestSend?.addEventListener("click", () => runPBTest("test_send"));
  pbBtnTestResp?.addEventListener("click", () => runPBTest("test_response"));
  pbBtnTestCode?.addEventListener("click", () => runPBTest("test_code"));

  // Save Provider
  pbBtnSave?.addEventListener("click", () => {
    const name = pbNameInput?.value.trim() || "Custom AI";
    const urlPattern = pbPatternInput?.value.trim() || "*://*/*";
    const id = activeEditingProviderId || "custom_" + Date.now();

    const providerObj = {
      id,
      name,
      urlPattern,
      enabled: true,
      selectors: getPBConfig(),
    };

    chrome.runtime.sendMessage({ type: "save_custom_provider", provider: providerObj }, (res) => {
      if (res && res.ok) {
        if (pbTestStatus) {
          pbTestStatus.textContent = `✓ Saved custom provider '${name}' successfully!`;
          pbTestStatus.style.color = "#34d399";
        }
        loadCustomProviders();
        setTimeout(() => {
          if (providerBuilderModal) providerBuilderModal.style.display = "none";
        }, 800);
      }
    });
  });

  // Listen for broadcast status updates
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === "zs-status") render(msg);
    });
  }

  // Initial load & periodic refresh
  refresh();
  setInterval(refresh, 2500);
})();
