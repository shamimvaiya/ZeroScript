# SPDX-License-Identifier: GPL-3.0-or-later
"""ZeroScript Protocol Definitions and Message Contracts."""

from __future__ import annotations
import enum
from typing import Any, Dict, List, Optional


class MessageType(str, enum.Enum):
    # Core lifecycle
    CONNECTED = "connected"
    PING = "ping"
    PONG = "pong"
    ERROR = "error"

    # Status & Connectors
    STATUS = "status"
    LIST_CONNECTORS = "list_connectors"
    CONNECTORS = "connectors"
    SET_ACTIVE_CONNECTOR = "set_active_connector"

    # Legacy Roblox-specific status (for 100% backward compatibility)
    STUDIO_STATUS = "studio_status"

    # Tools
    LIST_TOOLS = "list_tools"
    TOOLS = "tools"
    CALL_TOOL = "call_tool"
    TOOL_RESULT = "tool_result"

    # Servers / MCP Lifecycle
    MCP_STATUS = "mcp_status"
    RESTART_MCP = "restart_mcp"
    ADD_SERVER = "add_server"
    REMOVE_SERVER = "remove_server"
    SERVER_CHANGED = "server_changed"


def make_response(
    msg_type: str | MessageType,
    request_id: Optional[Any] = None,
    ok: bool = True,
    error: Optional[str] = None,
    **extra: Any,
) -> Dict[str, Any]:
    """Create a standardized response envelope."""
    payload: Dict[str, Any] = {
        "type": msg_type.value if isinstance(msg_type, MessageType) else str(msg_type),
        "ok": ok,
    }
    if request_id is not None:
        payload["id"] = request_id
    if error is not None:
        payload["error"] = error
    payload.update(extra)
    return payload

