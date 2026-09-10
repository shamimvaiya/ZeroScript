# SPDX-License-Identifier: GPL-3.0-or-later
"""Android Studio Connector for Universal Agent."""

from __future__ import annotations
import shutil
import subprocess
import sys
from typing import Any, Dict, List, Optional
from connectors.base import BaseConnector


class AndroidStudioConnector(BaseConnector):
    id = "android_studio"
    name = "Android Studio"
    description = "Controls Android project builds, Gradle tasks, and ADB device/emulator actions"
    target_software = "AndroidStudio"
    implementation_status = "NOT IMPLEMENTED"

    def is_available(self) -> bool:
        if sys.platform == "win32":
            try:
                r = subprocess.run(
                    ["tasklist", "/FI", "IMAGENAME eq studio64.exe", "/NH"],
                    capture_output=True, text=True, timeout=1.5,
                )
                return "studio64.exe" in (r.stdout or "")
            except Exception:
                pass
        return shutil.which("adb") is not None

    def probe(self) -> Dict[str, Any]:
        return {
            "available": self.is_available(),
            "connected": False,
            "adb": shutil.which("adb") is not None,
            "note": "Android Studio connector ready for Gradle / ADB integration",
        }

    def list_tools(self, fresh: bool = False) -> List[Dict[str, Any]]:
        return [
            {
                "name": "android/run_gradle_task",
                "description": "Run a Gradle build task (e.g. assembleDebug, test)",
                "inputSchema": {
                    "type": "object",
                    "properties": {"task": {"type": "string"}},
                    "required": ["task"],
                },
            },
            {
                "name": "android/adb_command",
                "description": "Run ADB command (e.g. logcat, install, shell)",
                "inputSchema": {
                    "type": "object",
                    "properties": {"command": {"type": "string"}},
                    "required": ["command"],
                },
            },
        ]

    def call_tool(self, name: str, args: Dict[str, Any], timeout: float = 120.0) -> Dict[str, Any]:
        return {
            "ok": False,
            "kind": "not_implemented",
            "error": f"Android Studio tool '{name}' will be active when connector plugin is paired",
        }

