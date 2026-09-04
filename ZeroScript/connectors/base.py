# SPDX-License-Identifier: GPL-3.0-or-later
"""Base interface for all Software Connectors in ZeroScript / Universal Agent."""

from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class BaseConnector(ABC):
    """Abstract base class for software connectors.

    Each target software (Roblox Studio, VS Code, Unity, Android Studio, etc.)
    implements this interface with its own transport (MCP, IPC, WebSocket,
    HTTP, or CLI), process monitoring, and tool capabilities.
    """

    id: str = "base"
    name: str = "Base Software Connector"
    description: str = ""
    target_software: str = "unknown"

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.enabled = True

    @abstractmethod
    def is_available(self) -> bool:
        """Check whether the target software or its runtime environment is available on this system."""
        raise NotImplementedError

    @abstractmethod
    def probe(self) -> Dict[str, Any]:
        """Probe the live state of the software (is app open, is project/session loaded, etc.)."""
        raise NotImplementedError

    @abstractmethod
    def list_tools(self, fresh: bool = False) -> List[Dict[str, Any]]:
        """List all tools exposed by this connector."""
        raise NotImplementedError

    @abstractmethod
    def call_tool(self, name: str, args: Dict[str, Any], timeout: float = 120.0) -> Dict[str, Any]:
        """Execute a tool command against the target software.

        Returns a dictionary:
            {"ok": True, "text": "...", "images": [...]} or
            {"ok": False, "kind": "...", "error": "..."}
        """
        raise NotImplementedError

    def health(self) -> Dict[str, Any]:
        """Return diagnostic health summary for this connector."""
        return {
            "id": self.id,
            "name": self.name,
            "available": self.is_available(),
            "enabled": self.enabled,
        }

    def start(self) -> None:
        """Lifecycle hook called when the connector is activated."""
        pass

    def stop(self) -> None:
        """Lifecycle hook called when the connector is stopped."""
        pass

