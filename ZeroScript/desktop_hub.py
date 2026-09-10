# SPDX-License-Identifier: GPL-3.0-or-later
"""
Devil-X / ZeroScript Master Hub - Native Desktop Control Panel (Tkinter GUI).
Provides a 100% genuine local Windows/Linux/macOS desktop application to manage:
- Step 1: AI Source Process / Tab Locking
- Step 2: Native Bridge WebSocket Server (ws://127.0.0.1:17613)
- Step 3: Target Software / IDE / MCP Connector Locking
"""

import sys
import os
import json
import time
import threading
import subprocess
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext

# Ensure local imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from process_manager import process_mgr
except Exception:
    process_mgr = None

try:
    from connectors import registry as connector_registry
except Exception:
    connector_registry = None


class DevilXDesktopHub:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Devil-X Master Hub - Universal 3-Tier Controller")
        self.root.geometry("960x680")
        self.root.minsize(820, 560)
        self.root.configure(bg="#0b0e14")

        self.bridge_process = None
        self.is_running = False

        self._setup_styles()
        self._build_ui()
        self._start_process_scanner()

    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use("clam")

        # Custom theme colors
        style.configure(".", background="#0b0e14", foreground="#f3f4f6", font=("Segoe UI", 9))
        style.configure("TFrame", background="#0b0e14")
        style.configure("Card.TFrame", background="#151923", relief="solid", borderwidth=1)
        style.configure("Header.TLabel", font=("Segoe UI", 12, "bold"), foreground="#818cf8", background="#151923")
        style.configure("SubHeader.TLabel", font=("Segoe UI", 9), foreground="#9ca3af", background="#151923")
        style.configure("Locked.TLabel", font=("Segoe UI", 10, "bold"), foreground="#10b981", background="#151923")

        style.configure("Accent.TButton", font=("Segoe UI", 9, "bold"), background="#4f46e5", foreground="#ffffff")
        style.map("Accent.TButton", background=[("active", "#4338ca")])

        style.configure("Danger.TButton", font=("Segoe UI", 9, "bold"), background="#dc2626", foreground="#ffffff")
        style.map("Danger.TButton", background=[("active", "#b91c1c")])

        style.configure("Treeview", background="#0d111a", foreground="#e2e8f0", fieldbackground="#0d111a", font=("Segoe UI", 9), rowheight=24)
        style.configure("Treeview.Heading", background="#1e2433", foreground="#93c5fd", font=("Segoe UI", 9, "bold"))
        style.map("Treeview", background=[("selected", "#3730a3")], foreground=[("selected", "#ffffff")])

    def _build_ui(self):
        # Top Bar
        top_bar = tk.Frame(self.root, bg="#111520", height=60, padx=16, pady=10)
        top_bar.pack(fill=tk.X, side=tk.TOP)

        title_lbl = tk.Label(top_bar, text="DEVIL-X UNIVERSAL MASTER CONTROLLER", font=("Segoe UI", 14, "bold"), fg="#818cf8", bg="#111520")
        title_lbl.pack(side=tk.LEFT)

        self.status_badge = tk.Label(top_bar, text="● BRIDGE OFFLINE", font=("Segoe UI", 10, "bold"), fg="#ef4444", bg="#261214", padx=10, pady=4, relief="groove")
        self.status_badge.pack(side=tk.RIGHT, padx=8)

        self.btn_toggle_bridge = tk.Button(top_bar, text="▶ Start Bridge Server", font=("Segoe UI", 9, "bold"), bg="#10b981", fg="#ffffff", padx=12, pady=4, relief="flat", command=self.toggle_bridge_server)
        self.btn_toggle_bridge.pack(side=tk.RIGHT)

        # Main 3-Tier Grid
        main_grid = tk.Frame(self.root, bg="#0b0e14", padx=12, pady=10)
        main_grid.pack(fill=tk.BOTH, expand=True)

        # 3 Columns
        main_grid.columnconfigure(0, weight=1)
        main_grid.columnconfigure(1, weight=1)
        main_grid.columnconfigure(2, weight=1)
        main_grid.rowconfigure(0, weight=1)

        # STEP 1: AI SOURCE TAB
        step1_frame = ttk.Frame(main_grid, style="Card.TFrame", padding=10)
        step1_frame.grid(row=0, column=0, sticky="nsew", padx=6, pady=6)

        ttk.Label(step1_frame, text="🌐 STEP 1: AI SOURCE TAB", style="Header.TLabel").pack(anchor="w")
        ttk.Label(step1_frame, text="Hook Chrome, Edge, Firefox, Brave AI Tabs", style="SubHeader.TLabel").pack(anchor="w", pady=(0, 6))

        self.lbl_source_lock = ttk.Label(step1_frame, text="Status: [UNLOCKED]", style="Locked.TLabel")
        self.lbl_source_lock.pack(anchor="w", pady=2)

        # Treeview for Browser processes
        cols1 = ("PID", "Browser", "Title")
        self.tree_source = ttk.Treeview(step1_frame, columns=cols1, show="headings", height=8)
        self.tree_source.heading("PID", text="PID")
        self.tree_source.heading("Browser", text="Process")
        self.tree_source.heading("Title", text="Window Title")
        self.tree_source.column("PID", width=55, stretch=False)
        self.tree_source.column("Browser", width=95, stretch=False)
        self.tree_source.column("Title", width=140)
        self.tree_source.pack(fill=tk.BOTH, expand=True, pady=6)

        btn_lock_src = tk.Button(step1_frame, text="🔒 Lock Selected AI Tab", bg="#4f46e5", fg="#ffffff", font=("Segoe UI", 9, "bold"), relief="flat", command=self.lock_selected_source)
        btn_lock_src.pack(fill=tk.X, pady=2)

        # STEP 2: MASTER CONTROLLER HUB
        step2_frame = ttk.Frame(main_grid, style="Card.TFrame", padding=10)
        step2_frame.grid(row=0, column=1, sticky="nsew", padx=6, pady=6)

        ttk.Label(step2_frame, text="⚙️ STEP 2: MY SOFTWARE HUB", style="Header.TLabel").pack(anchor="w")
        ttk.Label(step2_frame, text="Native Process & MCP Coordinator", style="SubHeader.TLabel").pack(anchor="w", pady=(0, 6))

        info_box = tk.Frame(step2_frame, bg="#0d111a", padx=8, pady=8)
        info_box.pack(fill=tk.X, pady=4)

        self.lbl_hub_port = tk.Label(info_box, text="Port: 17613 (WebSocket)", fg="#93c5fd", bg="#0d111a", font=("Segoe UI", 9, "bold"))
        self.lbl_hub_port.pack(anchor="w")

        self.lbl_hub_mode = tk.Label(info_box, text="Mode: Native Background Process", fg="#a7f3d0", bg="#0d111a", font=("Segoe UI", 8))
        self.lbl_hub_mode.pack(anchor="w")

        self.lbl_hub_active = tk.Label(info_box, text="Target Connector: Visual Studio", fg="#fde047", bg="#0d111a", font=("Segoe UI", 8))
        self.lbl_hub_active.pack(anchor="w")

        ttk.Label(step2_frame, text="Quick Connector Selector:", style="SubHeader.TLabel").pack(anchor="w", pady=(8, 2))
        self.conn_var = tk.StringVar(value="visual_studio")
        conn_combo = ttk.Combobox(step2_frame, textvariable=self.conn_var, values=["visual_studio", "vscode", "unity", "android_studio", "roblox"], state="readonly")
        conn_combo.pack(fill=tk.X, pady=2)
        conn_combo.bind("<<ComboboxSelected>>", self.on_connector_change)

        btn_rescan = tk.Button(step2_frame, text="🔄 Rescan OS Processes", bg="#1f2937", fg="#e5e7eb", font=("Segoe UI", 8), relief="flat", command=self.refresh_process_lists)
        btn_rescan.pack(fill=tk.X, pady=6)

        # STEP 3: TARGET SOFTWARE / IDE
        step3_frame = ttk.Frame(main_grid, style="Card.TFrame", padding=10)
        step3_frame.grid(row=0, column=2, sticky="nsew", padx=6, pady=6)

        ttk.Label(step3_frame, text="🛠️ STEP 3: TARGET SOFTWARE", style="Header.TLabel").pack(anchor="w")
        ttk.Label(step3_frame, text="Visual Studio, VS Code, Unity, Android Studio", style="SubHeader.TLabel").pack(anchor="w", pady=(0, 6))

        self.lbl_target_lock = ttk.Label(step3_frame, text="Status: [UNLOCKED]", style="Locked.TLabel")
        self.lbl_target_lock.pack(anchor="w", pady=2)

        cols3 = ("PID", "IDE", "Project/Title")
        self.tree_target = ttk.Treeview(step3_frame, columns=cols3, show="headings", height=8)
        self.tree_target.heading("PID", text="PID")
        self.tree_target.heading("IDE", text="Process")
        self.tree_target.heading("Project/Title", text="Title / Solution")
        self.tree_target.column("PID", width=55, stretch=False)
        self.tree_target.column("IDE", width=95, stretch=False)
        self.tree_target.column("Project/Title", width=140)
        self.tree_target.pack(fill=tk.BOTH, expand=True, pady=6)

        btn_lock_tgt = tk.Button(step3_frame, text="🔒 Lock Selected Target IDE", bg="#4f46e5", fg="#ffffff", font=("Segoe UI", 9, "bold"), relief="flat", command=self.lock_selected_target)
        btn_lock_tgt.pack(fill=tk.X, pady=2)

        # Bottom Log Viewer
        log_frame = tk.Frame(self.root, bg="#080a0f", height=160, padx=12, pady=8)
        log_frame.pack(fill=tk.X, side=tk.BOTTOM)

        log_hdr = tk.Label(log_frame, text="📜 Live Activity & MCP Execution Log", font=("Segoe UI", 9, "bold"), fg="#9ca3af", bg="#080a0f")
        log_hdr.pack(anchor="w")

        self.log_text = scrolledtext.ScrolledText(log_frame, bg="#05070a", fg="#a7f3d0", font=("Consolas", 9), height=7, insertbackground="#ffffff")
        self.log_text.pack(fill=tk.BOTH, expand=True, pady=4)
        self.log("Devil-X Master Desktop Hub initialized. Ready to lock processes.")

    def log(self, message: str, level="INFO"):
        t = time.strftime("%H:%M:%S")
        self.log_text.insert(tk.END, f"[{t}] [{level}] {message}\n")
        self.log_text.see(tk.END)

    def toggle_bridge_server(self):
        if not self.is_running:
            # Start bridge.py subprocess
            script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bridge.py")
            try:
                self.bridge_process = subprocess.Popen([sys.executable, script_path], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
                self.is_running = True
                self.status_badge.config(text="● BRIDGE ACTIVE (ws://127.0.0.1:17613)", fg="#10b981", bg="#0d2818")
                self.btn_toggle_bridge.config(text="⏹ Stop Bridge Server", bg="#dc2626")
                self.log("Bridge WebSocket server started on ws://127.0.0.1:17613", "SUCCESS")

                threading.Thread(target=self._read_bridge_logs, daemon=True).start()
            except Exception as e:
                self.log(f"Failed to start bridge server: {e}", "ERROR")
                messagebox.showerror("Error", f"Failed to start bridge.py:\n{e}")
        else:
            if self.bridge_process:
                self.bridge_process.terminate()
                self.bridge_process = None
            self.is_running = False
            self.status_badge.config(text="● BRIDGE OFFLINE", fg="#ef4444", bg="#261214")
            self.btn_toggle_bridge.config(text="▶ Start Bridge Server", bg="#10b981")
            self.log("Bridge server stopped by user.", "WARN")

    def _read_bridge_logs(self):
        if not self.bridge_process or not self.bridge_process.stdout:
            return
        for line in self.bridge_process.stdout:
            if line.strip():
                self.log(f"[bridge] {line.strip()}")

    def _start_process_scanner(self):
        self.refresh_process_lists()

    def refresh_process_lists(self):
        if not process_mgr:
            self.log("ProcessManager not found in local environment.", "WARN")
            return

        procs = process_mgr.list_processes()
        browsers = procs.get("browsers", [])
        target_ides = procs.get("target_ides", [])

        # Populate Source
        for item in self.tree_source.get_children():
            self.tree_source.delete(item)
        for b in browsers:
            self.tree_source.insert("", tk.END, values=(b.get("pid"), b.get("name"), b.get("title") or b.get("app_name")), tags=(json.dumps(b),))

        # Populate Target
        for item in self.tree_target.get_children():
            self.tree_target.delete(item)
        for t in target_ides:
            self.tree_target.insert("", tk.END, values=(t.get("pid"), t.get("name"), t.get("title") or t.get("app_name")), tags=(json.dumps(t),))

        self.log(f"Process list refreshed: {len(browsers)} browsers, {len(target_ides)} IDEs detected.")

    def lock_selected_source(self):
        sel = self.tree_source.selection()
        if not sel:
            messagebox.showinfo("Select Process", "Please select a browser/tab process from the list first.")
            return
        vals = self.tree_source.item(sel[0], "values")
        data_tag = self.tree_source.item(sel[0], "tags")
        data = json.loads(data_tag[0]) if data_tag else {"pid": vals[0], "name": vals[1], "title": vals[2]}

        if process_mgr:
            process_mgr.lock_source(data)

        self.lbl_source_lock.config(text=f"Locked: {vals[1]} (PID: {vals[0]})", foreground="#10b981")
        self.log(f"Step 1 Locked: {vals[1]} [PID {vals[0]}] - Title: {vals[2]}", "SUCCESS")

    def lock_selected_target(self):
        sel = self.tree_target.selection()
        if not sel:
            messagebox.showinfo("Select IDE", "Please select a target IDE/software process from the list first.")
            return
        vals = self.tree_target.item(sel[0], "values")
        data_tag = self.tree_target.item(sel[0], "tags")
        data = json.loads(data_tag[0]) if data_tag else {"pid": vals[0], "name": vals[1], "title": vals[2]}

        cid = data.get("connector_id", "visual_studio")
        self.conn_var.set(cid)

        if process_mgr:
            process_mgr.lock_target(data)
        if connector_registry:
            connector_registry.active_id = cid

        self.lbl_target_lock.config(text=f"Locked: {vals[1]} (PID: {vals[0]})", foreground="#10b981")
        self.lbl_hub_active.config(text=f"Target Connector: {vals[1]}")
        self.log(f"Step 3 Locked: {vals[1]} [PID {vals[0]}] -> Connector: {cid}", "SUCCESS")

    def on_connector_change(self, event=None):
        selected_cid = self.conn_var.get()
        if connector_registry:
            connector_registry.active_id = selected_cid
        self.lbl_hub_active.config(text=f"Target Connector: {selected_cid}")
        self.log(f"Active Connector switched to: {selected_cid}")


def main():
    root = tk.Tk()
    app = DevilXDesktopHub(root)
    root.mainloop()


if __name__ == "__main__":
    main()
