# SPDX-License-Identifier: GPL-3.0-or-later
"""Base interface for Local AI model providers (Ollama, LM Studio, etc.)."""

from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, Dict, List, Optional


class LocalAIProvider(ABC):
    """Abstract interface for local AI model runtimes."""

    id: str = "base_local_ai"
    name: str = "Base Local AI"

    def __init__(self, base_url: str, model: str = ""):
        self.base_url = base_url.rstrip("/")
        self.model = model

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if the local AI daemon/server is responding."""
        raise NotImplementedError

    @abstractmethod
    async def list_models(self) -> List[str]:
        """List models installed or available on this local runtime."""
        raise NotImplementedError

    @abstractmethod
    async def chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        """Stream chat tokens from the local model."""
        raise NotImplementedError

