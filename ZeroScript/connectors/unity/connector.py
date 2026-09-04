# SPDX-License-Identifier: GPL-3.0-or-later
"""Unity Editor Connector for Universal Agent."""

from __future__ import annotations
import shutil
import subprocess
import sys
from typing import Any, Dict, List, Optional
from connectors.base import BaseConnector


class UnityConnector(BaseConnector):
    id = "unity"
    name = "Unity Editor"
    description = "Controls Unity Editor scenes, game objects, and C# scripts via local bridge"
    target_software = "Unity"

    def is_available(self) -> bool:
        if sys.platform == "win32":
            try:
                r = subprocess.run(
                    ["tasklist", "/FI", "IMAGENAME eq Unity.exe", "/NH"],
                    capture_output=True, text=True, timeout=1.5,
                )
                return "Unity.exe" in (r.stdout or "")
            except Exception:
                pass
        return shutil.which("Unity") is not None

    def probe(self) -> Dict[str, Any]:
        return {
            "available": self.is_available(),
            "connected": False,
            "note": "Unity connector ready for Unity Editor package pairing",
        }

    def list_tools(self, fresh: bool = False) -> List[Dict[str, Any]]:
        return [
            {
                "name": "unity/execute_csharp",
                "description": "Execute C# code in Unity Editor context",
                "inputSchema": {
                    "type": "object",
                    "properties": {"code": {"type": "string"}},
                    "required": ["code"],
                },
            },
            {
                "name": "unity/inspect_gameobject",
                "description": "Inspect GameObject hierarchy and components in current scene",
                "inputSchema": {
                    "type": "object",
                    "properties": {"path": {"type": "string"}},
                    "required": ["path"],
                },
            },
        ]

    def call_tool(self, name: str, args: Dict[str, Any], timeout: float = 120.0) -> Dict[str, Any]:
        return {
            "ok": False,
            "kind": "not_implemented",
            "error": f"Unity tool '{name}' will be active when Unity package is paired",
        }

