# SPDX-License-Identifier: GPL-3.0-or-later
"""Ollama Local AI Provider for ZeroScript / Universal Agent."""

from __future__ import annotations
import asyncio
import json
import urllib.request
import urllib.error
from typing import Any, AsyncIterator, Dict, List, Optional
from local_ai.base import LocalAIProvider


class OllamaProvider(LocalAIProvider):
    id = "ollama"
    name = "Ollama Local AI"

    def __init__(self, base_url: str = "http://127.0.0.1:11434", model: str = "qwen2.5-coder:7b"):
        super().__init__(base_url, model)

    async def is_available(self) -> bool:
        def _check():
            try:
                req = urllib.request.Request(f"{self.base_url}/api/version", method="GET")
                with urllib.request.urlopen(req, timeout=1.5) as resp:
                    return resp.status == 200
            except Exception:
                return False
        return await asyncio.to_thread(_check)

    async def list_models(self) -> List[str]:
        def _fetch():
            try:
                req = urllib.request.Request(f"{self.base_url}/api/tags", method="GET")
                with urllib.request.urlopen(req, timeout=3.0) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    return [m.get("name", "") for m in data.get("models", [])]
            except Exception:
                return []
        return await asyncio.to_thread(_fetch)

    async def chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if system_prompt:
            payload["messages"] = [{"role": "system", "content": system_prompt}] + messages

        def _call():
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                f"{self.base_url}/api/chat",
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=60.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("message", {}).get("content", "")

        result = await asyncio.to_thread(_call)
        yield result

