#!/usr/bin/env python3
"""Morda helper for a Mac. Installed by the person's own Claude when they set up Morda from the app.

What it does:
  hook   Claude Code runs this when a chat starts, gets a message, finishes, asks, or ends.
         It sends Morda a short fact: the chat's name, its folder name, and, when Claude asked
         the person something, that question (cut to 400 characters, secrets hidden).
  tick   The Morda task runs this every 15 minutes: says the Mac is awake, lists which Claude
         chats are open, and collects answers the person typed on their phone.
  ack    The Morda task tells Morda an answer was handed to its chat.

What it never sends: what the person typed, files, chat transcripts, passwords or keys.
Python 3.9+ standard library only. Stops quietly on any error so Claude is never disturbed.
Remove: delete ~/.claude/morda and the "morda_mac.py hook" lines in ~/.claude/settings.json.
"""
from __future__ import annotations

import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

VERSION = "8.0.0"
HOME = Path.home()
DIR = HOME / ".claude" / "morda"
CONFIG = DIR / "config.json"
SPOOL = DIR / "spool.jsonl"
LOCK = DIR / "spool.lock"
SKIP = DIR / "skip.json"
SESSIONS = HOME / ".claude" / "sessions"
HOOK_EVENTS = ("SessionStart", "UserPromptSubmit", "Stop", "Notification", "SessionEnd")
ASK_CHARS = 400
TAIL_BYTES = 256 * 1024

SECRETS = [
    re.compile(r"\b(?:sk|pk|rk)-[A-Za-z0-9_\-]{16,}"),
    re.compile(r"\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}"),
    re.compile(r"\bxox[abprs]-[A-Za-z0-9\-]{10,}"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\b(?:ma|mk|mat|mrt|mh)_[A-Za-z0-9_\-]{16,}"),
    re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{5,}"),
    re.compile(r"\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?\b"),
    re.compile(r"\b(?:\d[ \-]?){12,19}\b"),
    re.compile(r"(?i)\b(password|passwd|pwd|token|secret|api[_ ]?key)\s*[:=]\s*\S+"),
]


def redact(text: str) -> str:
    for pat in SECRETS:
        text = pat.sub(lambda m: (m.group(1) + ": [hidden]") if m.re.groups else "[hidden]", text)
    return text


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text())
    except Exception:
        return default


def config() -> dict:
    return load_json(CONFIG, {})


# ---- reading what Claude Code keeps on this Mac (never sent as is) ----
def open_chats() -> list:
    """Claude chats open right now, from Claude Code's own session registry."""
    chats = []
    for f in SESSIONS.glob("*.json"):
        d = load_json(f, None)
        if not isinstance(d, dict) or not d.get("sessionId"):
            continue
        pid = d.get("pid")
        try:
            if pid:
                os.kill(int(pid), 0)
        except (ProcessLookupError, ValueError):
            continue
        except PermissionError:
            pass
        chats.append(d)
    return chats


def chat_name(sid: str) -> str:
    for d in open_chats():
        if d.get("sessionId") == sid and d.get("name"):
            return str(d["name"])
    return ""


def tail_lines(path: str) -> list:
    try:
        with open(path, "rb") as fh:
            fh.seek(0, 2)
            size = fh.tell()
            fh.seek(max(0, size - TAIL_BYTES))
            data = fh.read().decode("utf-8", "replace")
    except Exception:
        return []
    lines = data.splitlines()
    return lines[1:] if size > TAIL_BYTES else lines


def title_from_transcript(path: str) -> str:
    for line in reversed(tail_lines(path)):
        if '"custom-title"' in line or '"customTitle"' in line:
            d = load_line(line)
            t = d.get("customTitle") or d.get("title")
            if t:
                return str(t)
    return ""


def load_line(line: str) -> dict:
    try:
        d = json.loads(line)
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


def text_of(message) -> str:
    content = (message or {}).get("content") if isinstance(message, dict) else message
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")
    return ""


def last_answer(path: str) -> str:
    for line in reversed(tail_lines(path)):
        if '"assistant"' not in line:
            continue
        d = load_line(line)
        if d.get("type") == "assistant":
            t = text_of(d.get("message"))
            if t.strip():
                return t
    return ""


def first_user_text(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            for i, line in enumerate(fh):
                if i > 60:
                    break
                d = load_line(line)
                if d.get("type") == "user":
                    return text_of(d.get("message"))
    except Exception:
        pass
    return ""


def question_in(answer: str) -> str:
    """The question at the end of Claude's answer, if it ends with one. Plain text, short."""
    text = re.sub(r"```.*?```", " ", answer or "", flags=re.S)
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paras:
        return ""
    # a very short last line ("Which one?") needs the lines just above it to make sense
    tail = paras[-3:] if len(paras[-1]) < 20 else paras[-1:]
    last = " ".join(tail)
    if "?" not in last[-600:]:
        return ""
    last = re.sub(r"[*_`#>]+", "", last)
    last = " ".join(last.split())
    last = redact(last)
    return last if len(last) <= ASK_CHARS else last[: ASK_CHARS - 3].rstrip() + "..."


def is_morda_chat(sid: str, transcript: str) -> bool:
    """The Morda task's own runs are not the person's chats."""
    skip = load_json(SKIP, {})
    if sid in skip:
        return skip[sid]
    mine = "morda_mac.py tick" in first_user_text(transcript) if transcript else False
    if transcript and first_user_text(transcript):
        skip[sid] = mine
        if len(skip) > 2000:
            skip = dict(list(skip.items())[-1000:])
        try:
            SKIP.write_text(json.dumps(skip))
        except Exception:
            pass
    return mine


# ---- talking to Morda ----
def post(path: str, body: dict, timeout: float = 8) -> dict:
    cfg = config()
    req = urllib.request.Request(
        cfg["base"].rstrip("/") + path, data=json.dumps(body).encode(), method="POST",
        headers={"Authorization": "Bearer " + cfg["key"], "Content-Type": "application/json",
                 "User-Agent": "morda-mac/" + VERSION},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode() or "{}")


def hello() -> dict:
    cfg = config()
    return {"host": cfg.get("host", "mac"), "name": cfg.get("name") or socket.gethostname(), "version": VERSION}


def flush() -> None:
    """Send what the hooks wrote down. One sender at a time; unsent lines wait for the next try."""
    import fcntl
    DIR.mkdir(parents=True, exist_ok=True)
    with open(LOCK, "w") as lk:
        try:
            fcntl.flock(lk, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            return
        for _ in range(20):
            try:
                lines = SPOOL.read_text().splitlines()
            except FileNotFoundError:
                return
            events = [load_line(x) for x in lines[:200]]
            events = [e for e in events if e.get("sid")]
            if events:
                post("/v8/mac/events", {**hello(), "events": events})
            rest = lines[200:]
            SPOOL.write_text("".join(x + "\n" for x in rest[-2000:]))
            if not rest:
                return


# ---- commands ----
def cmd_hook() -> None:
    raw = sys.stdin.read()
    if not CONFIG.exists():
        return
    d = load_line(raw)
    name, sid = d.get("hook_event_name"), d.get("session_id")
    if not sid or name not in HOOK_EVENTS:
        return
    transcript = d.get("transcript_path") or ""
    if is_morda_chat(sid, transcript):
        return
    ev = {"sid": sid}
    if name == "SessionStart":
        ev["event"] = "start"
    elif name == "UserPromptSubmit":
        ev["event"] = "prompt"          # only that the person wrote; never what
    elif name == "Stop":
        ev["event"] = "stop"
        ask = question_in(d.get("last_assistant_message") or last_answer(transcript))
        if ask:
            ev["ask"] = ask
    elif name == "Notification":
        kind = str(d.get("notification_type") or "")
        msg = str(d.get("message") or "")
        if kind == "permission_prompt" or (not kind and "permission" in msg.lower()):
            ev["event"] = "permission"
            ev["ask"] = redact(" ".join(msg.split()))[:ASK_CHARS] or "Claude is waiting for your OK to go on."
        elif kind == "idle_prompt":
            ev["event"] = "idle"
        else:
            return
    elif name == "SessionEnd":
        ev["event"] = "end"
    title = chat_name(sid) or title_from_transcript(transcript)
    if title:
        ev["title"] = title[:120]
    if d.get("cwd"):
        ev["project"] = os.path.basename(str(d["cwd"]).rstrip("/"))[:60]
    DIR.mkdir(parents=True, exist_ok=True)
    with open(SPOOL, "a") as fh:
        fh.write(json.dumps(ev) + "\n")
    # send in the background so Claude never waits on the network
    subprocess.Popen([sys.executable, os.path.abspath(__file__), "send"], stdin=subprocess.DEVNULL,
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True, close_fds=True)


def ancestors() -> set:
    pids, pid = set(), os.getpid()
    for _ in range(12):
        try:
            out = subprocess.run(["ps", "-o", "ppid=", "-p", str(pid)], capture_output=True, text=True, timeout=2)
            pid = int(out.stdout.strip() or 0)
        except Exception:
            break
        if pid <= 1:
            break
        pids.add(pid)
    return pids


def cmd_tick() -> None:
    out = {"ok": False}
    try:
        try:
            flush()
        except Exception:
            pass
        mine = ancestors()
        chats = []
        for c in open_chats():
            if c.get("pid") in mine:
                continue  # the Morda task's own chat
            sid = str(c["sessionId"])
            chats.append({"sid": sid, "title": str(c.get("name") or "")[:120] or None,
                          "project": os.path.basename(str(c.get("cwd") or "").rstrip("/"))[:60] or None,
                          "busy": c.get("status") == "busy"})
        res = post("/v8/mac/tick", {**hello(), "chats": chats})
        out = {"ok": True, "replies": res.get("replies", []), "update_list": bool(res.get("update_list"))}
    except Exception as e:  # noqa: BLE001 - report, never crash the task
        out["error"] = type(e).__name__ + ": " + str(e)[:200]
    print(json.dumps(out, indent=1))


def cmd_ack(args: list) -> None:
    if len(args) < 2:
        print('usage: morda_mac.py ack <id> delivered|closed|failed ["note"]')
        return
    res = post("/v8/mac/ack", {"id": args[0], "result": args[1], "note": " ".join(args[2:])[:200] or None})
    print(json.dumps(res))


def hook_block() -> dict:
    cmd = "python3 \"$HOME/.claude/morda/morda_mac.py\" hook"
    entry = {"hooks": [{"type": "command", "command": cmd, "timeout": 10}]}
    return {name: [entry] for name in HOOK_EVENTS}


def cmd_install(args: list) -> None:
    opts = dict(zip(args[::2], args[1::2]))
    key, base = opts.get("--key", ""), opts.get("--base", "")
    if not key.startswith("mh_") or not base.startswith("https://"):
        print(json.dumps({"ok": False, "error": "need --key mh_... and --base https://..."}))
        return
    DIR.mkdir(parents=True, exist_ok=True)
    cfg = config()
    try:
        name = subprocess.run(["scutil", "--get", "ComputerName"], capture_output=True, text=True, timeout=3).stdout.strip()
    except Exception:
        name = ""
    cfg.update(key=key, base=base.rstrip("/"), name=name or socket.gethostname(),
               host=cfg.get("host") or "mac-" + os.urandom(4).hex())
    CONFIG.write_text(json.dumps(cfg, indent=1))
    os.chmod(CONFIG, 0o600)
    try:
        post("/v8/mac/tick", {**hello(), "chats": None})
        reach = True
    except Exception as e:  # noqa: BLE001
        reach = type(e).__name__ + ": " + str(e)[:120]
    print(json.dumps({"ok": reach is True, "reached_morda": reach, "computer": cfg["name"],
                      "add_to_settings_json_hooks": hook_block()}, indent=1))


def cmd_check() -> None:
    s = load_json(HOME / ".claude" / "settings.json", {})
    hooks = s.get("hooks") or {}
    have = [n for n in HOOK_EVENTS if "morda_mac.py" in json.dumps(hooks.get(n) or [])]
    print(json.dumps({"config": CONFIG.exists(), "hooks_in_settings": have,
                      "missing": [n for n in HOOK_EVENTS if n not in have]}, indent=1))


def main() -> None:
    cmd, args = (sys.argv[1] if len(sys.argv) > 1 else ""), sys.argv[2:]
    try:
        if cmd == "hook":
            cmd_hook()
        elif cmd == "send":
            time.sleep(0.2)
            flush()
        elif cmd == "tick":
            cmd_tick()
        elif cmd == "ack":
            cmd_ack(args)
        elif cmd == "install":
            cmd_install(args)
        elif cmd == "check":
            cmd_check()
        else:
            print(__doc__)
    except Exception as e:  # noqa: BLE001
        if cmd in ("hook", "send"):
            return  # never disturb Claude
        print(json.dumps({"ok": False, "error": type(e).__name__ + ": " + str(e)[:200]}))


if __name__ == "__main__":
    main()
