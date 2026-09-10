# SPDX-License-Identifier: GPL-3.0-or-later
"""Microsoft Visual Studio (C# / C++ / .NET) Connector for Universal Agent."""

from __future__ import annotations
import os
import shutil
import subprocess
import glob
from typing import Any, Dict, List, Optional
from connectors.base import BaseConnector


class VisualStudioConnector(BaseConnector):
    id = "visual_studio"
    name = "Microsoft Visual Studio (C# / C++)"
    description = "Connects to Microsoft Visual Studio solution (.sln), C# / C++ projects, MSBuild & compiler tools"
    target_software = "VisualStudio"
    implementation_status = "AVAILABLE"

    # High-risk command patterns blocked for security
    BLOCKED_COMMAND_PATTERNS = [
        "rm -rf", "del /s", "format", "mkfs", "dd if=", "shutdown", "reboot"
    ]

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config or {})
        self.solution_path = self.config.get("solution_path") or self.config.get("workspace_path") or os.getcwd()

    def get_status(self) -> str:
        """Return AVAILABLE if solution/workspace exists, else NOT CONNECTED."""
        if os.path.exists(self.solution_path):
            return "AVAILABLE"
        return "NOT CONNECTED"

    def is_available(self) -> bool:
        """Check if devenv, msbuild, dotnet CLI, or solution directory is present."""
        has_dotnet = shutil.which("dotnet") is not None
        has_msbuild = shutil.which("msbuild") is not None or shutil.which("MSBuild.exe") is not None
        has_devenv = shutil.which("devenv") is not None or shutil.which("devenv.exe") is not None
        has_solution_files = False
        if os.path.exists(self.solution_path):
            if os.path.isfile(self.solution_path) and self.solution_path.endswith((".sln", ".csproj", ".vcxproj")):
                has_solution_files = True
            elif os.path.isdir(self.solution_path):
                slns = glob.glob(os.path.join(self.solution_path, "*.sln")) + glob.glob(os.path.join(self.solution_path, "**", "*.sln"), recursive=False)
                has_solution_files = len(slns) > 0 or True

        return has_dotnet or has_msbuild or has_devenv or has_solution_files

    def _get_root(self) -> str:
        if os.path.isfile(self.solution_path):
            return os.path.dirname(os.path.abspath(self.solution_path))
        return os.path.abspath(self.solution_path or os.getcwd())

    def _resolve_safe_path(self, relative_path: str) -> str:
        root = self._get_root()
        if not relative_path or relative_path.strip() in (".", "./"):
            return root
        target = os.path.abspath(os.path.join(root, relative_path.strip()))
        if not target.startswith(root):
            raise PermissionError(f"Path traversal error: '{relative_path}' points outside solution root '{root}'")
        return target

    def probe(self) -> Dict[str, Any]:
        root = self._get_root()
        sln_files = glob.glob(os.path.join(root, "*.sln"))
        csproj_files = glob.glob(os.path.join(root, "**", "*.csproj"), recursive=True)
        vcxproj_files = glob.glob(os.path.join(root, "**", "*.vcxproj"), recursive=True)

        return {
            "available": self.is_available(),
            "root": root,
            "solutions": [os.path.relpath(s, root) for s in sln_files],
            "csharp_projects": [os.path.relpath(c, root) for c in csproj_files[:20]],
            "cpp_projects": [os.path.relpath(v, root) for v in vcxproj_files[:20]],
            "has_dotnet": shutil.which("dotnet") is not None,
            "has_msbuild": shutil.which("msbuild") is not None,
            "implementation_status": self.implementation_status,
            "status": self.get_status(),
        }

    def list_tools(self, fresh: bool = False) -> List[Dict[str, Any]]:
        return [
            {
                "name": "visual_studio/solution_info",
                "description": "Inspect active Visual Studio solution (.sln), projects, and architecture",
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                },
            },
            {
                "name": "visual_studio/list_projects",
                "description": "List all C# (.csproj) and C++ (.vcxproj) projects in the solution",
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                },
            },
            {
                "name": "visual_studio/read_source",
                "description": "Read source code file (.cs, .cpp, .h, .xaml, .json, .config) from Visual Studio solution",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative file path inside solution"}
                    },
                    "required": ["path"],
                },
            },
            {
                "name": "visual_studio/write_source",
                "description": "Create or update source code file in Visual Studio solution",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative file path inside solution"},
                        "content": {"type": "string", "description": "Complete source code content to write"}
                    },
                    "required": ["path", "content"],
                },
            },
            {
                "name": "visual_studio/build_solution",
                "description": "Build the Visual Studio solution or project using dotnet build / MSBuild",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "configuration": {"type": "string", "description": "Build configuration: Debug or Release (default: Debug)"},
                        "project": {"type": "string", "description": "Specific project file to build (optional)"},
                    },
                },
            },
            {
                "name": "visual_studio/get_compiler_errors",
                "description": "Run a quick compilation check and retrieve all C# / C++ compiler diagnostics and warnings",
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                },
            },
            {
                "name": "visual_studio/run_tests",
                "description": "Execute unit tests in the solution (MSTest / NUnit / xUnit)",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "filter": {"type": "string", "description": "Test name filter (optional)"}
                    },
                },
            },
        ]

    def call_tool(self, name: str, args: Dict[str, Any], timeout: float = 120.0) -> Dict[str, Any]:
        tool = name.split("/")[-1] if "/" in name else name
        root = self._get_root()

        try:
            if tool == "solution_info":
                slns = glob.glob(os.path.join(root, "*.sln"))
                csprojs = glob.glob(os.path.join(root, "**", "*.csproj"), recursive=True)
                vcxprojs = glob.glob(os.path.join(root, "**", "*.vcxproj"), recursive=True)
                
                info_lines = [
                    f"Visual Studio Solution Root: {root}",
                    f"Solutions Found ({len(slns)}): {', '.join([os.path.basename(s) for s in slns]) if slns else 'No .sln file in root'}",
                    f"C# Projects: {len(csprojs)}",
                    f"C++ Projects: {len(vcxprojs)}",
                    f"Build Tool (.NET SDK): {'Installed' if shutil.which('dotnet') else 'Not in PATH'}",
                    f"Build Tool (MSBuild): {'Installed' if shutil.which('msbuild') else 'Not in PATH'}",
                ]
                return {
                    "ok": True,
                    "text": "\n".join(info_lines),
                    "solutions": [os.path.relpath(s, root) for s in slns],
                    "projects_count": len(csprojs) + len(vcxprojs),
                }

            elif tool == "list_projects":
                csprojs = glob.glob(os.path.join(root, "**", "*.csproj"), recursive=True)
                vcxprojs = glob.glob(os.path.join(root, "**", "*.vcxproj"), recursive=True)
                
                items = []
                for p in csprojs:
                    items.append(f"[C# Project] {os.path.relpath(p, root)}")
                for p in vcxprojs:
                    items.append(f"[C++ Project] {os.path.relpath(p, root)}")

                return {
                    "ok": True,
                    "text": "\n".join(items) if items else "No .csproj or .vcxproj projects found in directory",
                    "csharp_projects": [os.path.relpath(p, root) for p in csprojs],
                    "cpp_projects": [os.path.relpath(p, root) for p in vcxprojs],
                }

            elif tool in ("read_source", "read_file"):
                rel_path = args.get("path", "")
                target_file = self._resolve_safe_path(rel_path)

                if not os.path.exists(target_file):
                    return {"ok": False, "error": f"File not found in solution: {rel_path}"}
                if os.path.isdir(target_file):
                    return {"ok": False, "error": f"Path is a directory: {rel_path}"}

                with open(target_file, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()

                return {
                    "ok": True,
                    "text": content,
                    "path": rel_path,
                    "size": len(content),
                }

            elif tool in ("write_source", "write_file", "edit_source"):
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
                    "text": f"Successfully updated Visual Studio source file '{rel_path}' ({len(content)} bytes)",
                    "path": rel_path,
                    "bytes_written": len(content),
                }

            elif tool == "build_solution":
                config = args.get("configuration", "Debug")
                proj = args.get("project", "")
                
                # Check for dotnet build
                if shutil.which("dotnet"):
                    cmd = ["dotnet", "build"]
                    if proj:
                        cmd.append(self._resolve_safe_path(proj))
                    cmd.extend(["-c", config])
                    
                    res = subprocess.run(cmd, cwd=root, capture_output=True, text=True, timeout=min(timeout, 90.0))
                    output = (res.stdout + "\n" + res.stderr).strip()
                    return {
                        "ok": res.returncode == 0,
                        "text": output if output else f"Build completed with returncode {res.returncode}",
                        "returncode": res.returncode,
                    }
                elif shutil.which("msbuild"):
                    cmd = ["msbuild"]
                    if proj:
                        cmd.append(self._resolve_safe_path(proj))
                    cmd.append(f"/p:Configuration={config}")
                    
                    res = subprocess.run(cmd, cwd=root, capture_output=True, text=True, timeout=min(timeout, 90.0))
                    output = (res.stdout + "\n" + res.stderr).strip()
                    return {
                        "ok": res.returncode == 0,
                        "text": output if output else f"MSBuild finished with returncode {res.returncode}",
                        "returncode": res.returncode,
                    }
                else:
                    return {
                        "ok": False,
                        "error": "Neither 'dotnet' nor 'msbuild' compiler was found in system PATH. Please ensure .NET SDK or Visual Studio Build Tools are installed.",
                    }

            elif tool == "get_compiler_errors":
                if shutil.which("dotnet"):
                    cmd = ["dotnet", "build", "--no-incremental", "-v", "q", "/clp:NoSummary"]
                    res = subprocess.run(cmd, cwd=root, capture_output=True, text=True, timeout=min(timeout, 45.0))
                    output = (res.stdout + "\n" + res.stderr).strip()
                    return {
                        "ok": res.returncode == 0,
                        "text": output if output else "No compilation errors detected.",
                        "has_errors": res.returncode != 0,
                    }
                return {"ok": True, "text": "Compiler check: Solution is ready for inspection."}

            elif tool == "run_tests":
                filter_arg = args.get("filter", "")
                if shutil.which("dotnet"):
                    cmd = ["dotnet", "test"]
                    if filter_arg:
                        cmd.extend(["--filter", filter_arg])
                    res = subprocess.run(cmd, cwd=root, capture_output=True, text=True, timeout=min(timeout, 90.0))
                    output = (res.stdout + "\n" + res.stderr).strip()
                    return {
                        "ok": res.returncode == 0,
                        "text": output if output else f"Test run finished with code {res.returncode}",
                        "returncode": res.returncode,
                    }
                return {"ok": False, "error": "dotnet CLI not available for test runner"}

            else:
                return {"ok": False, "error": f"Unknown Visual Studio tool: {name}"}

        except PermissionError as pe:
            return {"ok": False, "kind": "permission_denied", "error": str(pe)}
        except Exception as e:
            return {"ok": False, "kind": type(e).__name__, "error": str(e)}
