# SPDX-License-Identifier: GPL-3.0-or-later
"""Visual Studio Code / Antigravity IDE Connector for Universal Agent."""

from __future__ import annotations
import shutil
from typing import Any, Dict, List, Optional
from connectors.base import BaseConnector


class VSCodeConnector(BaseConnector):
    id = "vscode"
    name = "Visual Studio Code"
    description = "Connects to VS Code / Antigravity IDE via workspace protocol or language server bridge"
    target_software = "VSCode"

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.workspace_path = self.config.get("workspace_path")

    def is_available(self) -> bool:
        """Check whether VS Code ('code') or Antigravity ('agy') executable is in PATH."""
        return shutil.which("code") is not None or shutil.which("agy") is not None

    def probe(self) -> Dict[str, Any]:
        return {
            "available": self.is_available(),
            "workspace": self.workspace_path,
            "connected": False,
            "note": "VS Code connector ready for extension integration",
        }

    def list_tools(self, fresh: bool = False) -> List[Dict[str, Any]]:
        return [
            {
                "name": "vscode/read_file",
                "description": "Read file content from the active VS Code workspace",
                "inputSchema": {
                    "type": "object",
                    "properties": {"path": {"type": "string"}},
                    "required": ["path"],
                },
            },
            {
                "name": "vscode/edit_file",
                "description": "Apply edits or replace content in a workspace file",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "content": {"type": "string"},
                    },
                    "required": ["path", "content"],
                },
            },
            {
                "name": "vscode/run_command",
                "description": "Execute a terminal command inside the workspace",
                "inputSchema": {
                    "type": "object",
                    "properties": {"command": {"type": "string"}},
                    "required": ["command"],
                },
            },
        ]

    def call_tool(self, name: str, args: Dict[str, Any], timeout: float = 120.0) -> Dict[str, Any]:
        # Placeholder implementation ready to be wired to the VS Code language server / websocket bridge
        return {
            "ok": False,
            "kind": "not_implemented",
            "error": f"VS Code tool '{name}' will be active when VS Code extension is paired",
        }

