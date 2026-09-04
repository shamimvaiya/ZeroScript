// SPDX-License-Identifier: GPL-3.0-or-later
// core/protocol.js - Universal AI-to-Software Protocol specifications.
// Defines standard message envelopes and software connector types.

/* eslint-disable no-unused-vars */
const ZSProtocol = (() => {
  "use strict";

  const MessageType = {
    CONNECTED: "connected",
    PING: "ping",
    PONG: "pong",
    STATUS: "status",
    STUDIO_STATUS: "studio_status", // Legacy Roblox Studio probe
    LIST_TOOLS: "list_tools",
    TOOLS: "tools",
    CALL_TOOL: "call_tool",
    TOOL_RESULT: "tool_result",
    LIST_CONNECTORS: "list_connectors",
    CONNECTORS: "connectors",
    SET_ACTIVE_CONNECTOR: "set_active_connector",
    SERVER_CHANGED: "server_changed",
    ERROR: "error",
  };

  const ConnectorId = {
    ROBLOX: "roblox",
    VSCODE: "vscode",
    UNITY: "unity",
    ANDROID_STUDIO: "android_studio",
  };

  /**
   * Split a tool call into connector prefix and bare tool name.
   * e.g. "roblox/execute_luau" -> { connectorId: "roblox", toolName: "execute_luau" }
   *      "execute_luau" -> { connectorId: null, toolName: "execute_luau" }
   */
  function parseToolName(fullName) {
    if (!fullName || typeof fullName !== "string") {
      return { connectorId: null, toolName: "" };
    }
    const idx = fullName.indexOf("/");
    if (idx !== -1) {
      return {
        connectorId: fullName.slice(0, idx),
        toolName: fullName.slice(idx + 1),
      };
    }
    return { connectorId: null, toolName: fullName };
  }

  /**
   * Format a tool call with optional connector namespace.
   */
  function formatToolName(connectorId, toolName) {
    return connectorId ? `${connectorId}/${toolName}` : toolName;
  }

  return {
    MessageType,
    ConnectorId,
    parseToolName,
    formatToolName,
  };
})();

