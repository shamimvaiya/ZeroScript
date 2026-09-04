# SPDX-License-Identifier: GPL-3.0-or-later
"""Connectors Layer for ZeroScript / Universal Agent."""

from connectors.base import BaseConnector
from connectors.registry import ConnectorRegistry, registry
from connectors.roblox import RobloxStudioConnector
from connectors.vscode import VSCodeConnector
from connectors.unity import UnityConnector
from connectors.android_studio import AndroidStudioConnector

__all__ = [
    "BaseConnector",
    "ConnectorRegistry",
    "registry",
    "RobloxStudioConnector",
    "VSCodeConnector",
    "UnityConnector",
    "AndroidStudioConnector",
]

