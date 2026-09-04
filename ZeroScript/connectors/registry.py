# SPDX-License-Identifier: GPL-3.0-or-later
"""Software Connector Registry for ZeroScript / Universal Agent."""

from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional
from connectors.base import BaseConnector

logger = logging.getLogger("connectors.registry")


class ConnectorRegistry:
    """Central registry of software connectors in the Universal Agent Bridge."""

    def __init__(self):
        self._connectors: Dict[str, BaseConnector] = {}
        self._active_id: str = "roblox"

    def register(self, connector: BaseConnector, set_active: bool = False) -> None:
        """Register a connector instance."""
        self._connectors[connector.id] = connector
        if set_active:
            self._active_id = connector.id

    def unregister(self, connector_id: str) -> Optional[BaseConnector]:
        """Unregister a connector by id."""
        return self._connectors.pop(connector_id, None)

    def get(self, connector_id: str) -> Optional[BaseConnector]:
        """Get a connector by id."""
        return self._connectors.get(connector_id)

    @property
    def active_id(self) -> str:
        return self._active_id

    @active_id.setter
    def active_id(self, val: str) -> None:
        if val in self._connectors:
            self._active_id = val

    def get_active(self) -> Optional[BaseConnector]:
        """Return the currently active primary connector."""
        return self._connectors.get(self._active_id)

    def list_connectors(self) -> List[Dict[str, Any]]:
        """Return summary of all registered connectors."""
        res = []
        for cid, conn in self._connectors.items():
            res.append({
                "id": conn.id,
                "name": conn.name,
                "description": conn.description,
                "target_software": getattr(conn, "target_software", cid),
                "is_active": cid == self._active_id,
                "available": conn.is_available(),
                "enabled": conn.enabled,
            })
        return res

    def list_tools(self, fresh: bool = False) -> List[Dict[str, Any]]:
        """List all tools exposed by active connectors."""
        active = self.get_active()
        if active:
            return active.list_tools(fresh=fresh)
        return []

    def call_tool(self, name: str, args: Dict[str, Any], timeout: float = 120.0) -> Dict[str, Any]:
        """Route tool execution to the appropriate connector."""
        # If tool name is namespaced e.g. "vscode/read_file" or "roblox/execute_luau"
        if "/" in name:
            prefix, bare_name = name.split("/", 1)
            conn = self.get(prefix)
            if conn:
                return conn.call_tool(bare_name, args, timeout=timeout)

        # Otherwise dispatch to active connector
        active = self.get_active()
        if active:
            return active.call_tool(name, args, timeout=timeout)

        return {
            "ok": False,
            "kind": "no_active_connector",
            "error": f"No active connector available to handle tool: {name}",
        }

    def probe_all(self) -> Dict[str, Any]:
        """Probe state across all registered connectors."""
        probes = {}
        for cid, conn in self._connectors.items():
            try:
                probes[cid] = conn.probe()
            except Exception as e:
                probes[cid] = {"error": str(e)}
        return probes


# Global registry singleton
registry = ConnectorRegistry()

