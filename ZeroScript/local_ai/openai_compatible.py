# SPDX-License-Identifier: GPL-3.0-or-later
"""OpenAI-compatible Local AI Provider (LM Studio, vLLM, LocalAI)."""

from __future__ import annotations
import asyncio
import json
import urllib.request
import urllib.error
from typing import Any, AsyncIterator, Dict, List, Optional
from local_ai.base import LocalAIProvider


class OpenAICompatibleProvider(LocalAIProvider):
    id = "openai_compatible"
    name = "Local OpenAI-Compatible Endpoint"

    def __init__(self, base_url: str = "http://127.0.0.1:1234/v1", model: str = "local-model"):
        super().__init__(base_url, model)

    async def is_available(self) -> bool:
        def _check():
            try:
                req = urllib.request.Request(f"{self.base_url}/models", method="GET")
                with urllib.request.urlopen(req, timeout=1.5) as resp:
                    return resp.status == 200
            except Exception:
                return False
        return await asyncio.to_thread(_check)

    async def list_models(self) -> List[str]:
        def _fetch():
            try:
                req = urllib.request.Request(f"{self.base_url}/models", method="GET")
                with urllib.request.urlopen(req, timeout=3.0) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    return [m.get("id", "") for m in data.get("data", [])]
            except Exception:
                return []
        return await asyncio.to_thread(_fetch)

    async def chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        all_msgs = []
        if system_prompt:
            all_msgs.append({"role": "system", "content": system_prompt})
        all_msgs.extend(messages)

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": all_msgs,
            "stream": False,
            "temperature": temperature,
        }

        def _call():
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                f"{self.base_url}/chat/completions",
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=60.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                choices = data.get("choices", [])
                if choices:
                    return choices[0].get("message", {}).get("content", "")
                return ""

        result = await asyncio.to_thread(_call)
        yield result

