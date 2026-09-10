# SPDX-License-Identifier: GPL-3.0-or-later
"""Visual Studio Code / Antigravity IDE Connector for Universal Agent."""

from __future__ import annotations
import os
import shutil
import subprocess
from typing import Any, Dict, List, Optional
from connectors.base import BaseConnector


class VSCodeConnector(BaseConnector):
    id = "vscode"
    name = "Visual Studio Code"
    description = "Connects to VS Code workspace to safely inspect, read, and edit project files"
    target_software = "VSCode"
    implementation_status = "AVAILABLE"

    # High-risk command patterns that must be blocked for safety
    BLOCKED_COMMAND_PATTERNS = [
        "rm -rf", "rm -r", "del /s", "del /f", "rd /s", "format",
        "mkfs", "dd if=", ":(){ :|:& };:", "shutdown", "reboot",
        "systemctl", "chmod -R 777", "chown -R", "drop database"
    ]

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config or {})
        self.workspace_path = self.config.get("workspace_path") or os.getcwd()

    def get_status(self) -> str:
        """Return AVAILABLE if workspace exists and is accessible, else NOT CONNECTED."""
        if os.path.exists(self.workspace_path) and os.path.isdir(self.workspace_path):
            return "AVAILABLE"
        return "NOT CONNECTED"

    def is_available(self) -> bool:
        """Check whether VS Code binary is in PATH or active workspace is accessible."""
        code_bin = shutil.which("code") is not None or shutil.which("code-insiders") is not None or shutil.which("agy") is not None
        return code_bin or (os.path.exists(self.workspace_path) and os.path.isdir(self.workspace_path))

    def _get_workspace_root(self) -> str:
        return os.path.abspath(self.workspace_path or os.getcwd())

    def _resolve_safe_path(self, relative_path: str) -> str:
        """Resolve path and enforce strict path traversal protection."""
        root = self._get_workspace_root()
        if not relative_path or relative_path.strip() in (".", "./"):
            return root
        target = os.path.abspath(os.path.join(root, relative_path.strip()))
        if not target.startswith(root):
            raise PermissionError(f"Path traversal error: '{relative_path}' points outside workspace '{root}'")
        return target

    def probe(self) -> Dict[str, Any]:
        root = self._get_workspace_root()
        exists = os.path.exists(root)
        return {
            "available": self.is_available(),
            "workspace": root,
            "workspace_exists": exists,
            "connected": exists,
            "implementation_status": self.implementation_status,
            "status": self.get_status(),
        }

    def list_tools(self, fresh: bool = False) -> List[Dict[str, Any]]:
        return [
            {
                "name": "vscode/workspace_info",
                "description": "Get active VS Code workspace information, root path, and structure",
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                },
            },
            {
                "name": "vscode/list_files",
                "description": "List relevant files inside the VS Code workspace",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "directory": {"type": "string", "description": "Relative subdirectory (optional)"},
                        "max_depth": {"type": "integer", "description": "Maximum directory search depth (default 3)"},
                    },
                },
            },
            {
                "name": "vscode/read_file",
                "description": "Read file content from the active VS Code workspace",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative file path inside workspace"}
                    },
                    "required": ["path"],
                },
            },
            {
                "name": "vscode/write_file",
                "description": "Write or update content in a VS Code workspace file",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative file path inside workspace"},
                        "content": {"type": "string", "description": "File content to write"},
                    },
                    "required": ["path", "content"],
                },
            },
            {
                "name": "vscode/edit_file",
                "description": "Alias for write_file to replace or update workspace files",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative file path inside workspace"},
                        "content": {"type": "string", "description": "File content to write"},
                    },
                    "required": ["path", "content"],
                },
            },
            {
                "name": "vscode/get_diagnostics",
                "description": "Check syntax/diagnostics for files in workspace",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Specific file path (optional)"}
                    },
                },
            },
            {
                "name": "vscode/run_command",
                "description": "Execute a restricted safe shell command inside workspace",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string", "description": "Safe terminal command to execute"}
                    },
                    "required": ["command"],
                },
            },
        ]

    def call_tool(self, name: str, args: Dict[str, Any], timeout: float = 120.0) -> Dict[str, Any]:
        tool = name.split("/")[-1] if "/" in name else name

        try:
            if tool == "workspace_info":
                root = self._get_workspace_root()
                items = os.listdir(root) if os.path.exists(root) else []
                top_items = [i for i in items if not i.startswith(".")]
                return {
                    "ok": True,
                    "text": f"Workspace Root: {root}\nProject Name: {os.path.basename(root)}\nTop Items: {', '.join(top_items[:15])}",
                    "workspace": root,
                    "item_count": len(items),
                }

            elif tool == "list_files":
                rel_dir = args.get("directory", "")
                max_depth = int(args.get("max_depth", 3))
                target_dir = self._resolve_safe_path(rel_dir)

                if not os.path.exists(target_dir):
                    return {"ok": False, "error": f"Directory not found: {rel_dir}"}

                found_files = []
                root = self._get_workspace_root()
                ignored_dirs = {".git", "node_modules", "__pycache__", ".venv", "dist", "build"}

                for current_root, dirs, files in os.walk(target_dir):
                    dirs[:] = [d for d in dirs if d not in ignored_dirs and not d.startswith(".")]
                    rel_current = os.path.relpath(current_root, root)
                    depth = 0 if rel_current == "." else rel_current.count(os.sep) + 1
                    if depth > max_depth:
                        dirs.clear()
                        continue
                    for f in files:
                        if not f.startswith("."):
                            rel_file = os.path.relpath(os.path.join(current_root, f), root)
                            found_files.append(rel_file)

                return {
                    "ok": True,
                    "text": "\n".join(found_files[:100]) if found_files else "No files found",
                    "files": found_files[:100],
                    "total": len(found_files),
                }

            elif tool in ("read_file", "get_file"):
                rel_path = args.get("path", "")
                target_file = self._resolve_safe_path(rel_path)

                if not os.path.exists(target_file):
                    return {"ok": False, "error": f"File not found: {rel_path}"}
                if os.path.isdir(target_file):
                    return {"ok": False, "error": f"Path is a directory, not a file: {rel_path}"}

                with open(target_file, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()

                return {
                    "ok": True,
                    "text": content,
                    "path": rel_path,
                    "size": len(content),
                }

            elif tool in ("write_file", "edit_file"):
                rel_path = args.get("path", "")
                content = args.get("content", "")
                target_file = self._resolve_safe_path(rel_path)

                parent_dir = os.path.dirname(target_file)
                if not os.path.exists(parent_dir):
                    os.makedirs(parent_dir, exist_ok=True)

                with open(target_file, "w", encoding="utf-8") as f:
                    f.write(content)

                return {
                    "ok": True,
                    "text": f"Successfully updated '{rel_path}' ({len(content)} bytes)",
                    "path": rel_path,
                    "bytes_written": len(content),
                }

            elif tool == "get_diagnostics":
                rel_path = args.get("path", "")
                if rel_path:
                    target_file = self._resolve_safe_path(rel_path)
                    if not os.path.exists(target_file):
                        return {"ok": False, "error": f"File not found: {rel_path}"}
                    if target_file.endswith(".py"):
                        try:
                            import py_compile
                            py_compile.compile(target_file, doraise=True)
                            return {"ok": True, "text": f"Diagnostics for {rel_path}: No syntax errors found."}
                        except py_compile.PyCompileError as pe:
                            return {"ok": True, "text": f"Syntax Error in {rel_path}: {pe}"}
                    elif target_file.endswith(".json"):
                        try:
                            import json
                            with open(target_file, "r", encoding="utf-8") as jf:
                                json.load(jf)
                            return {"ok": True, "text": f"Diagnostics for {rel_path}: Valid JSON."}
                        except Exception as je:
                            return {"ok": True, "text": f"JSON Error in {rel_path}: {je}"}
                    return {"ok": True, "text": f"File {rel_path} is accessible."}

                return {"ok": True, "text": f"Workspace diagnostics active at {self._get_workspace_root()}."}

            elif tool == "run_command":
                cmd = args.get("command", "").strip()
                if not cmd:
                    return {"ok": False, "error": "No command provided"}

                cmd_lower = cmd.lower()
                for blocked in self.BLOCKED_COMMAND_PATTERNS:
                    if blocked in cmd_lower:
                        return {
                            "ok": False,
                            "kind": "security_blocked",
                            "error": f"Command blocked by security policy: destructive pattern '{blocked}' detected",
                        }

                root = self._get_workspace_root()
                res = subprocess.run(
                    cmd,
                    shell=True,
                    cwd=root,
                    capture_output=True,
                    text=True,
                    timeout=min(timeout, 30.0),
                )
                output = (res.stdout + "\n" + res.stderr).strip()
                return {
                    "ok": res.returncode == 0,
                    "text": output if output else f"Command completed with code {res.returncode}",
                    "returncode": res.returncode,
                }

            else:
                return {"ok": False, "error": f"Unknown VS Code tool: {name}"}

        except PermissionError as pe:
            return {"ok": False, "kind": "permission_denied", "error": str(pe)}
        except Exception as e:
            return {"ok": False, "kind": type(e).__name__, "error": str(e)}
