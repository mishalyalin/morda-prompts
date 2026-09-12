# Morda prompts

Morda is a small blind mailbox between your own Claude and a phone app. Your Claude writes a morning brief, encrypts it and drops it in a box; the app decrypts it, and your done/later/work marks travel back the same way. The server in between stores ciphertext only and never holds the secret. This repo holds the prompts you paste into Claude Code, the client script they install, and the specs both sides follow. Read them before you paste - that is the point of keeping them public.

## Pairing

1. In the app, create a box and copy the setup prompt (it carries your box id and secret).
2. Paste it into Claude Code; it follows `prompts/claude-code-e2e.md`, installs `~/.morda/morda.mjs`, checks its sha256, writes `~/.morda/config.json` and sends the first brief.
3. Open the app: the brief is there, and a daily local routine keeps it coming.

## Security model in plain words

- The secret is created on your phone and typed into Claude Code once. It is stored in `~/.morda/config.json` (mode 600) and nowhere else.
- Everything uploaded is AES-256-GCM encrypted with keys derived from the secret. The server sees a box id, ciphertext and a derived login token. It cannot read a brief or a mark.
- The script has no dependencies and talks to exactly one URL, the one in your config. `spec/protocol.md` is the whole wire format.
- The prompts tell Claude to verify the script's sha256 against the value printed in the prompt at this tag, and to never print or store the secret anywhere but the config file.

## Files

| path | what |
|------|------|
| `morda.mjs` | client script: `state`, `send`, `brief`, `pending`, `reply`, `watch` |
| `morda.test.mjs` | `node --test morda.test.mjs` |
| `prompts/claude-code-e2e.md` | first-time setup (install, config, first brief, daily routine) |
| `prompts/claude-code-e2e-existing.md` | add Morda to a routine you already run |
| `prompts/routine-work.md` | optional 15-minute routine that answers tasks you hand to Claude |
| `prompts/work-prompt.md` | the one-line prompt used per task by `watch` |
| `spec/brief.md` | what a brief contains and its JSON shape |
| `spec/state.md` | what the app sends back |
| `spec/protocol.md` | keys, encryption, endpoints, seq, retention |

## Versions

| tag | script sha256 | notes |
|-----|---------------|-------|
| v3.0.0 | `25b14db24defeb62e7d05bb42dd59817d9164823e8c59c411b7172a07019852a` | first public release |

MIT, see `LICENSE`.
