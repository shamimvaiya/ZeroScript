# SPDX-License-Identifier: GPL-3.0-or-later
"""Local AI Providers package for ZeroScript / Universal Agent."""

from local_ai.base import LocalAIProvider
from local_ai.ollama import OllamaProvider
from local_ai.openai_compatible import OpenAICompatibleProvider

__all__ = ["LocalAIProvider", "OllamaProvider", "OpenAICompatibleProvider"]

