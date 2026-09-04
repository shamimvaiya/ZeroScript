// SPDX-License-Identifier: GPL-3.0-or-later
// core/connectors.js - Software Connector registry and metadata in the extension.

/* eslint-disable no-unused-vars */
const ZSConnectors = (() => {
  "use strict";

  const connectors = new Map();
  let activeConnectorId = "roblox";

  // Register built-in Roblox Studio Connector
  connectors.set("roblox", {
    id: "roblox",
    name: "Roblox Studio",
    description: "Controls Roblox Studio place, Luau scripts, and game tree via MCP",
    targetSoftware: "RobloxStudio",
    toolCategory: (name) => {
      const n = (name || "").includes("/") ? name.split("/").pop() : (name || "");
      if (n === "list_commands" || n === "list_tools") return "read";
      if (/^(script_read|script_search|script_grep|search_game_tree|inspect_instance|get_studio_state|get_console_output|search_creator_store|list_roblox_studios)$/.test(n))
        return "read";
      if (/^(multi_edit|insert_from_creator_store|store_image)$/.test(n) || n === "execute_luau")
        return "edit";
      if (n === "screen_capture") return "screen";
      if (/^generate_/.test(n)) return "generate";
      if (n.startsWith("roblox") || /studio|luau|instance|workspace/i.test(n)) return "roblox";
      return "tool";
    },
  });

  // Register VS Code / Antigravity IDE Connector metadata
  connectors.set("vscode", {
    id: "vscode",
    name: "Visual Studio Code",
    description: "Inspects workspace files, edits code, and executes terminal commands",
    targetSoftware: "VSCode",
    toolCategory: (name) => {
      const n = (name || "").includes("/") ? name.split("/").pop() : (name || "");
      if (/read|search|grep|list/i.test(n)) return "read";
      if (/edit|write|patch|create/i.test(n)) return "edit";
      if (/run|exec|terminal|command/i.test(n)) return "tool";
      return "tool";
    },
  });

  // Register Unity Connector metadata
  connectors.set("unity", {
    id: "unity",
    name: "Unity Editor",
    description: "Inspects scenes, edits C# scripts, and interacts with GameObjects",
    targetSoftware: "Unity",
    toolCategory: (name) => {
      const n = (name || "").includes("/") ? name.split("/").pop() : (name || "");
      if (/read|inspect|find|search/i.test(n)) return "read";
      if (/csharp|edit|create|modify/i.test(n)) return "edit";
      return "tool";
    },
  });

  // Register Android Studio Connector metadata
  connectors.set("android_studio", {
    id: "android_studio",
    name: "Android Studio",
    description: "Builds Android apps, runs Gradle tasks, and controls ADB devices",
    targetSoftware: "AndroidStudio",
    toolCategory: (name) => {
      const n = (name || "").includes("/") ? name.split("/").pop() : (name || "");
      if (/logcat|read|status/i.test(n)) return "read";
      if (/edit|build|gradle/i.test(n)) return "edit";
      if (/adb|shell|install/i.test(n)) return "tool";
      return "tool";
    },
  });

  function register(connector) {
    if (connector && connector.id) {
      connectors.set(connector.id, connector);
    }
  }

  function get(id) {
    return connectors.get(id) || null;
  }

  function list() {
    return Array.from(connectors.values());
  }

  function getActive() {
    return connectors.get(activeConnectorId) || connectors.get("roblox");
  }

  function setActive(id) {
    if (connectors.has(id)) {
      activeConnectorId = id;
      return true;
    }
    return false;
  }

  function categorizeTool(name) {
    // If tool is explicitly prefixed with connector name:
    if (name && name.includes("/")) {
      const [prefix, bare] = name.split("/", 2);
      const conn = connectors.get(prefix);
      if (conn && conn.toolCategory) {
        return conn.toolCategory(bare);
      }
    }
    // Fall back to active connector's category logic
    const active = getActive();
    if (active && active.toolCategory) {
      return active.toolCategory(name);
    }
    return "tool";
  }

  return {
    register,
    get,
    list,
    getActive,
    setActive,
    categorizeTool,
  };
})();

