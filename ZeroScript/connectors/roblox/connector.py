# SPDX-License-Identifier: GPL-3.0-or-later
"""Roblox Studio Connector for ZeroScript / Universal Agent."""

from __future__ import annotations
import os
import subprocess
import sys
from typing import Any, Dict, List, Optional
from connectors.base import BaseConnector

try:
    import launch_studio_mcp as _studio_scan
except Exception:
    _studio_scan = None


class RobloxStudioConnector(BaseConnector):
    id = "roblox"
    name = "Roblox Studio"
    description = "Drives Roblox Studio via local MCP server integration"
    target_software = "RobloxStudio"

    def __init__(self, mcp_manager: Optional[Any] = None, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.mcp_manager = mcp_manager

    def is_available(self) -> bool:
        """Check whether Roblox Studio executable or StudioMCP binary is present."""
        if _studio_scan and hasattr(_studio_scan, "find_studio_mcp"):
            try:
                return _studio_scan.find_studio_mcp() is not None
            except Exception:
                pass
        return False

    def is_app_running(self) -> Optional[bool]:
        """Check whether a RobloxStudio process is currently running on the OS."""
        if sys.platform != "win32":
            return None
        try:
            r = subprocess.run(
                ["tasklist", "/FI", "IMAGENAME eq RobloxStudioBeta.exe", "/NH"],
                capture_output=True, text=True, timeout=1.5,
            )
            out = (r.stdout or "") + (r.stderr or "")
            if "RobloxStudioBeta.exe" in out:
                return True
            r2 = subprocess.run(
                ["tasklist", "/FI", "IMAGENAME eq RobloxStudio.exe", "/NH"],
                capture_output=True, text=True, timeout=1.5,
            )
            out2 = (r2.stdout or "") + (r2.stderr or "")
            return "RobloxStudio.exe" in out2
        except Exception:
            return None

    def probe(self) -> Dict[str, Any]:
        """Probe Roblox Studio place and app status."""
        proc = self.is_app_running()
        if self.mcp_manager and hasattr(self.mcp_manager, "probe_studio"):
            res = self.mcp_manager.probe_studio()
            res["studio_proc"] = proc
            return res
        return {
            "place": None,
            "app": None,
            "studio_proc": proc,
            "mcp_alive": self.mcp_manager.any_alive() if self.mcp_manager else False,
        }

    def list_tools(self, fresh: bool = False) -> List[Dict[str, Any]]:
        """List Roblox Studio MCP tools."""
        if self.mcp_manager:
            return self.mcp_manager.list_tools(fresh=fresh)
        return []

    def call_tool(self, name: str, args: Dict[str, Any], timeout: float = 120.0) -> Dict[str, Any]:
        """Execute a tool against Roblox Studio via MCP."""
        if not self.mcp_manager:
            return {"ok": False, "kind": "unavailable", "error": "MCP manager not initialized"}
        return self.mcp_manager.call_tool(name, args, timeout=timeout)

    def health(self) -> Dict[str, Any]:
        base = super().health()
        base.update({
            "app_running": self.is_app_running(),
            "mcp_alive": self.mcp_manager.any_alive() if self.mcp_manager else False,
        })
        return base

