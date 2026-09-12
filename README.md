# Morda prompts

## Nothing to install: relay mode

Since v3.1 the default way to use Morda needs nothing on your computer. You add one connector URL to Claude.ai, ChatGPT (Developer mode + scheduled tasks) or Claude Code, paste one prompt, and create one routine that runs every 15 minutes if your assistant allows it, otherwise as often as it allows (hourly is fine). The routine calls the connector's `get_pending` tool, answers the tasks you pressed Work on, and posts each answer with `reply_task`; the app shows the reply on the routine's next run. Nothing runs on your laptop, and nothing in this repo is needed for it: the prompts come from the app itself. In relay mode the Morda server stores your brief and tasks in plain text so your assistant can read and answer them.

The rest of this repo is the encrypted option below, for Claude Code only: the server stores ciphertext it cannot open, at the price of a script that Claude Code fetches where it runs.

## Encrypted mode

Morda is a small blind mailbox between your own Claude and a phone app. Your Claude writes a morning brief, encrypts it and drops it in a box; the app decrypts it, and your done/later/work marks travel back the same way. The server in between stores ciphertext only and never holds the secret. This repo holds the prompts you paste into Claude Code, the client script they install, and the specs both sides follow. Read them before you paste - that is the point of keeping them public.

## Pairing

1. In the app, create a box and copy the setup prompt (it carries your box id and secret).
2. Paste it into Claude Code; it follows `prompts/claude-code-e2e.md`, installs `~/.morda/morda.mjs`, checks its sha256, writes `~/.morda/config.json` and sends the first brief.
3. Open the app: the brief is there, and a daily routine keeps it coming. Paste the task routine prompt as a scheduled cloud routine every 15 minutes, and the tasks you hand to Claude get answered with nothing running on your computer. The laptop `watch` command is optional, for people who want answers within a minute while their laptop is open.

## Security model in plain words

- The secret is created on your phone and typed into Claude Code once. It is stored in `~/.morda/config.json` (mode 600) and nowhere else.
- Everything uploaded is AES-256-GCM encrypted with keys derived from the secret. The server sees a box id, ciphertext and a derived login token. It cannot read a brief or a mark.
- The script has no dependencies and talks to exactly one URL, the one in your config. `spec/protocol.md` is the whole wire format.
- The prompts tell Claude to verify the script's sha256 against the value printed in the prompt at this tag, and to never print or store the secret anywhere but the config file. The cloud task routine is the one place the secret travels beyond that file: its routine message carries the box id and secret so the routine can write the config on the machine it runs on.

## Files

| path | what |
|------|------|
| `morda.mjs` | client script: `state`, `send`, `brief`, `pending`, `reply`, `watch` |
| `morda.test.mjs` | `node --test morda.test.mjs` |
| `prompts/claude-code-e2e.md` | first-time setup (install, config, first brief, daily routine) |
| `prompts/claude-code-e2e-existing.md` | add Morda to a routine you already run |
| `prompts/routine-work.md` | cloud routine (every 15 minutes) that answers tasks you hand to Claude, nothing running on your computer |
| `prompts/work-prompt.md` | the one-line prompt used per task by `watch`, the optional laptop watcher for answers within a minute while the laptop is open |
| `spec/brief.md` | what a brief contains and its JSON shape |
| `spec/state.md` | what the app sends back |
| `spec/protocol.md` | keys, encryption, endpoints, seq, retention |

## Versions

| tag | script sha256 | notes |
|-----|---------------|-------|
| v3.0.1 | `9f4d94736870b112838c83500cfd6ea1b8b570da01481f1bd0703e309cb86e16` | task routine runs in the cloud again; replies never swallow a note typed meanwhile; clear errors on a wrong URL or secret; watch remembers what it handled |
| v3.0.0 | `25b14db24defeb62e7d05bb42dd59817d9164823e8c59c411b7172a07019852a` | first public release |

MIT, see `LICENSE`.
