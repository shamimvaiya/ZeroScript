# SPDX-License-Identifier: GPL-3.0-or-later
"""Software Connector Registry for ZeroScript / Universal Agent."""

from __future__ import annotations
import json
import logging
import os
from typing import Any, Dict, List, Optional
from connectors.base import BaseConnector

logger = logging.getLogger("connectors.registry")

CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config.json")


class ConnectorRegistry:
    """Central registry of software connectors in the Universal Agent Bridge."""

    def __init__(self):
        self._connectors: Dict[str, BaseConnector] = {}
        self._active_id: str = self._load_saved_active_id() or "roblox"

    def _load_saved_active_id(self) -> Optional[str]:
        try:
            if os.path.exists(CONFIG_PATH):
                with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return data.get("activeConnector")
        except Exception:
            pass
        return None

    def _save_active_id(self, val: str) -> None:
        try:
            data = {}
            if os.path.exists(CONFIG_PATH):
                with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
            data["activeConnector"] = val
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to persist active connector: {e}")

    def register(self, connector: BaseConnector, set_active: bool = False) -> None:
        """Register a connector instance."""
        self._connectors[connector.id] = connector
        if set_active:
            self._active_id = connector.id
            self._save_active_id(connector.id)

    def unregister(self, connector_id: str) -> Optional[BaseConnector]:
        """Unregister a connector by id."""
        return self._connectors.pop(connector_id, None)

    def get(self, connector_id: str) -> Optional[BaseConnector]:
        """Get a connector by id."""
        return self._connectors.get(connector_id)

    @property
    def connectors(self) -> Dict[str, BaseConnector]:
        return self._connectors

    @property
    def active_id(self) -> str:
        return self._active_id

    @active_id.setter
    def active_id(self, val: str) -> None:
        if val in self._connectors:
            self._active_id = val
            self._save_active_id(val)

    def get_active(self) -> Optional[BaseConnector]:
        """Return the currently active primary connector."""
        return self._connectors.get(self._active_id)

    def list_connectors(self) -> List[Dict[str, Any]]:
        """Return summary of all registered connectors with standard status."""
        res = []
        for cid, conn in self._connectors.items():
            status = conn.get_status() if hasattr(conn, "get_status") else ("AVAILABLE" if conn.is_available() else "NOT CONNECTED")
            impl_status = getattr(conn, "implementation_status", "NOT IMPLEMENTED")
            res.append({
                "id": conn.id,
                "name": conn.name,
                "description": conn.description,
                "target_software": getattr(conn, "target_software", cid),
                "is_active": cid == self._active_id,
                "status": status,
                "implementation_status": impl_status,
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

try:
    from connectors.roblox import RobloxStudioConnector
    from connectors.visual_studio import VisualStudioConnector
    from connectors.vscode import VSCodeConnector
    from connectors.unity import UnityConnector
    from connectors.android_studio import AndroidStudioConnector

    registry.register(RobloxStudioConnector())
    registry.register(VisualStudioConnector())
    registry.register(VSCodeConnector(), set_active=False)
    registry.register(UnityConnector())
    registry.register(AndroidStudioConnector())
    # Default to first available if none active
    if not registry.active_id and registry.connectors:
        registry._active_id = list(registry.connectors.keys())[0]
except Exception:
    pass

