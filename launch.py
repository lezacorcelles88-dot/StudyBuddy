"""
StudyBuddy Launcher
===================
Starts StudyBuddy Flask app + tries to create a FREE public URL.

Tunnel services tried (in order):
  1. localhost.run  -- SSH tunnel, no install
  2. serveo.net     -- SSH tunnel, no install
  3. Local only     -- fallback, works on same WiFi network

Usage:
    python launch.py
    python launch.py --port 5000
    python launch.py --no-tunnel     (skip public URL, local only)
    python launch.py --no-browser    (don't auto-open browser)
"""

import sys
import os
import re
import time
import json
import threading
import subprocess
import argparse
import webbrowser

# Force UTF-8 output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ---- Parse arguments ---------------------------------------------------------
parser = argparse.ArgumentParser(description='Launch StudyBuddy')
parser.add_argument('--port',       type=int, default=5000)
parser.add_argument('--no-tunnel',  action='store_true')
parser.add_argument('--no-browser', action='store_true')
args = parser.parse_args()
PORT = args.port

DIVIDER = "=" * 62
print(DIVIDER)
print("  STUDYBUDDY -- VOICE-BASED STUDY ASSISTANT (BSIT)")
print("  Starting...")
print(DIVIDER)

# ---- Get local IP ------------------------------------------------------------
def get_local_ip():
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

LOCAL_IP = get_local_ip()

# ---- SSH tunnel helpers -------------------------------------------------------
def try_ssh_tunnel(host, port, result_holder, timeout=12):
    """Try an SSH reverse tunnel and capture the public URL."""
    cmd = [
        "ssh",
        "-o", "StrictHostKeyChecking=no",
        "-o", "ConnectTimeout=8",
        "-o", "ServerAliveInterval=20",
        "-o", "ServerAliveCountMax=3",
        "-R", f"80:localhost:{port}",
        host
    ]
    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        result_holder["proc"] = proc
        deadline = time.time() + timeout
        for line in proc.stdout:
            line = line.strip()
            # Match typical tunnel URL formats
            m = re.search(r'https?://[\w.-]+\.(lhr\.life|serveo\.net|localhost\.run)', line)
            if m:
                result_holder["url"] = m.group(0)
                if not result_holder["url"].startswith("https://"):
                    result_holder["url"] = result_holder["url"].replace("http://", "https://")
                break
            if time.time() > deadline:
                break
        if "url" not in result_holder:
            proc.terminate()
    except Exception as e:
        result_holder["error"] = str(e)

public_url = None
tunnel_proc = None

if not args.no_tunnel:
    TUNNELS = [
        ("nokey@localhost.run", "localhost.run"),
        ("serveo.net",          "serveo.net"),
    ]
    for ssh_host, display_name in TUNNELS:
        print(f"  [>>] Trying {display_name} SSH tunnel...")
        result = {}
        t = threading.Thread(target=try_ssh_tunnel, args=(ssh_host, PORT, result), daemon=True)
        t.start()
        t.join(timeout=14)

        if "url" in result:
            public_url = result["url"]
            tunnel_proc = result.get("proc")
            break
        else:
            print(f"  [--] {display_name} unavailable, trying next...")

    if public_url:
        print()
        print("  +---------------------------------------------------------+")
        print(f"  |  PUBLIC URL : {public_url}")
        print("  |  Share this link -- works from any device/internet!    |")
        print("  +---------------------------------------------------------+")
        print()
        print(f"  Local WiFi : http://{LOCAL_IP}:{PORT}")
        print(f"  Public     : {public_url}")
        print()
        print("  NOTE: URL changes every restart. Free tunnels may expire.")
        print()
    else:
        print()
        print("  [WARN] No public tunnel available (firewall/no internet).")
        print(f"  [>>]  Share on same WiFi: http://{LOCAL_IP}:{PORT}")
        print(f"  [>>]  Local access:       http://127.0.0.1:{PORT}")
        print()
        print("  To get a public URL, try these options:")
        print("  1. Allow ngrok through Windows Defender (see README)")
        print("  2. Use a mobile hotspot and run again")
        print("  3. Deploy to Render.com (free, always-on)")
        print()
else:
    print(f"  [>>] Running locally: http://127.0.0.1:{PORT}")
    print(f"  [>>] Same WiFi:       http://{LOCAL_IP}:{PORT}")
    print()

# ---- Auto-open browser -------------------------------------------------------
def open_browser():
    time.sleep(2.5)
    url = public_url if public_url else f"http://127.0.0.1:{PORT}"
    if not args.no_browser:
        webbrowser.open(url)

threading.Thread(target=open_browser, daemon=True).start()

# ---- Start Flask app ---------------------------------------------------------
print("  [>>] Starting StudyBuddy Flask server...")
print("  [>>] Press Ctrl+C to stop.")
print()

os.chdir(os.path.dirname(os.path.abspath(__file__)))

try:
    from app import app as flask_app
    flask_app.run(host='0.0.0.0', port=PORT, debug=False, use_reloader=False)
except KeyboardInterrupt:
    print("\n\n  Shutting down StudyBuddy...")
    if tunnel_proc:
        try:
            tunnel_proc.terminate()
        except Exception:
            pass
    print("  Goodbye!")
    sys.exit(0)
