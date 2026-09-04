# SPDX-License-Identifier: GPL-3.0-or-later
"""ZeroScript Native Messaging Host for Chrome / Chromium browsers.

Allows the browser extension to query bridge status, launch the local bridge
in the background (without popping open an invasive cmd terminal), stop it,
or restart it cleanly.
"""

from __future__ import annotations
import json
import os
import struct
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
BRIDGE_PY = os.path.join(HERE, "bridge.py")
BRIDGE_PORT = int(os.environ.get("ZS_BRIDGE_PORT", "17613"))


def read_message() -> dict | None:
    """Read a message from stdin using Chrome's native messaging protocol (4-byte length prefix)."""
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) < 4:
        return None
    message_length = struct.unpack("<I", raw_length)[0]
    message_data = sys.stdin.buffer.read(message_length).decode("utf-8")
    return json.loads(message_data)


def send_message(message: dict) -> None:
    """Send a message to stdout using Chrome's native messaging protocol."""
    encoded_data = json.dumps(message).encode("utf-8")
    length = len(encoded_data)
    sys.stdout.buffer.write(struct.pack("<I", length))
    sys.stdout.buffer.write(encoded_data)
    sys.stdout.buffer.flush()


def is_port_listening(port: int = BRIDGE_PORT) -> bool:
    """Check if the bridge port is currently in use."""
    if sys.platform != "win32":
        return False
    try:
        cmd = f'netstat -aon | findstr :{port} | findstr LISTENING'
        out = subprocess.check_output(cmd, shell=True, text=True, timeout=2.0)
        return bool(out.strip())
    except Exception:
        return False


def get_bridge_pids(port: int = BRIDGE_PORT) -> list[int]:
    """Find process IDs listening on the bridge port."""
    if sys.platform != "win32":
        return []
    pids = set()
    try:
        cmd = f'netstat -aon | findstr :{port} | findstr LISTENING'
        out = subprocess.check_output(cmd, shell=True, text=True, timeout=2.0)
        for line in out.splitlines():
            parts = line.strip().split()
            if len(parts) >= 5 and parts[1].endswith(f":{port}"):
                try:
                    pids.add(int(parts[-1]))
                except ValueError:
                    pass
    except Exception:
        pass
    return list(pids)


def find_python_executable(prefer_windowless: bool = True) -> str:
    """Find a usable python/pythonw executable."""
    if prefer_windowless:
        # Check pythonw.exe in sys.executable's folder
        base_dir = os.path.dirname(sys.executable)
        pyw = os.path.join(base_dir, "pythonw.exe")
        if os.path.isfile(pyw):
            return pyw
    return sys.executable


def start_bridge(windowless: bool = True) -> dict:
    """Start bridge.py in the background."""
    if is_port_listening(BRIDGE_PORT):
        return {"ok": True, "status": "already_running", "port": BRIDGE_PORT}

    py_exe = find_python_executable(prefer_windowless=windowless)
    creationflags = 0
    if sys.platform == "win32" and windowless:
        # DETACHED_PROCESS = 0x00000008, CREATE_NO_WINDOW = 0x08000000
        creationflags = 0x08000000 | 0x00000008

    try:
        proc = subprocess.Popen(
            [py_exe, BRIDGE_PY],
            cwd=HERE,
            creationflags=creationflags,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            close_fds=True,
        )
        # Give it a second to bind
        time.sleep(1.0)
        running = is_port_listening(BRIDGE_PORT)
        return {
            "ok": True,
            "status": "started" if running else "starting",
            "pid": proc.pid,
            "port": BRIDGE_PORT,
            "windowless": windowless,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def stop_bridge() -> dict:
    """Stop running bridge process(es)."""
    pids = get_bridge_pids(BRIDGE_PORT)
    if not pids:
        return {"ok": True, "status": "already_stopped"}

    killed = []
    for pid in pids:
        try:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True, timeout=3.0)
            killed.append(pid)
        except Exception:
            pass
    return {"ok": True, "status": "stopped", "pids": killed}


def main():
    while True:
        try:
            msg = read_message()
            if msg is None:
                break
            action = msg.get("action") or msg.get("type")
            rid = msg.get("id")

            response = {"id": rid, "ok": True}

            if action == "ping":
                response.update({"action": "pong", "host": "com.zeroscript.agent", "version": "1.5.3"})

            elif action == "status":
                listening = is_port_listening(BRIDGE_PORT)
                pids = get_bridge_pids(BRIDGE_PORT)
                response.update({
                    "bridge_running": listening,
                    "port": BRIDGE_PORT,
                    "pids": pids,
                })

            elif action == "start":
                windowless = msg.get("windowless", True)
                res = start_bridge(windowless=windowless)
                response.update(res)

            elif action == "stop":
                res = stop_bridge()
                response.update(res)

            elif action == "restart":
                stop_bridge()
                time.sleep(1.0)
                res = start_bridge(windowless=msg.get("windowless", True))
                response.update(res)

            else:
                response.update({"ok": False, "error": f"Unknown action: {action}"})

            send_message(response)
        except Exception as e:
            send_message({"ok": False, "error": str(e)})
            break


if __name__ == "__main__":
    main()

