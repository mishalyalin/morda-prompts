# Morda protocol (v2 boxes, client v3)

One page. Everything the server stores is an opaque blob; the secret never leaves your devices.

## Box

- A box is created by the app with a random 32-byte secret (shown once as base64url, kept by you) and a box id.
- The server stores only `auth_hash = sha256(auth token)` for the box; it never sees the secret.
- Per box there are two kinds of blob, `brief` (written by your Claude, read by the app) and `state` (written by the app, read by your Claude).

## Keys (HKDF-SHA256, empty salt, 32-byte output)

| label         | use                                             |
|---------------|-------------------------------------------------|
| `morda-brief` | AES key for `brief` blobs                       |
| `morda-state` | AES key for `state` blobs                       |
| `morda-auth`  | bearer token = base64url(HKDF output), no padding |

Input keying material is the raw 32-byte secret.

## Encryption

- AES-256-GCM, random 12-byte IV per blob, 16-byte tag.
- `blob = base64( iv || ciphertext || tag )`.
- AAD (additional authenticated data) = the UTF-8 string `<box id>|<kind>|<seq>`. A blob therefore cannot be replayed under another box, kind or sequence number without failing authentication.
- Plaintext is UTF-8 JSON: the brief document (`spec/brief.md`) or the state document (`spec/state.md`).

## Endpoints (all under `<url>/v2/boxes/<box id>`, header `Authorization: Bearer <auth token>`)

| method | path          | body / result                                              |
|--------|---------------|------------------------------------------------------------|
| GET    | `/<kind>`     | `{seq, blob}` or 404 when nothing stored yet               |
| GET    | `/<kind>/seq` | `{seq}` (0 when nothing stored yet)                        |
| PUT    | `/<kind>`     | `{seq, blob}`; `seq` must be strictly greater than the stored one, else 409 with `{current}` |

## Seq

- Every write carries a `seq`; the server accepts it only if it is above the current one, so two writers cannot silently overwrite each other. The client reads `/seq`, adds one, and retries once on 409.
- The brief carries `acked_state_seq` so the app knows which of your marks Claude has seen.

## Retention

- `brief`: pruned 24 hours after the app has read it, or 7 days after upload if never read.
- `state`: never pruned while the box exists.
- Box creation is rate-limited per IP.

## What the server can learn

Box id, blob sizes and timing, your IP, and the auth token hash. Not the secret, not the plaintext, not the keys.
