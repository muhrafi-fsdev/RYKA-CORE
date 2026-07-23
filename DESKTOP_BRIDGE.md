# RYKA CORE 4.4 Secure Desktop Bridge

The bridge is an optional local Windows companion that converts validated gesture actions into allowlisted keyboard or media-key events.

## Start

```powershell
npm run dev:desktop
```

This launcher generates a fresh 256-bit bootstrap token and provides it independently to the Vite UI and local bridge process. The token is not written to source code or the audit log.

## Security design

- Binds only to `127.0.0.1:3210`
- Accepts only `http://localhost:3200` and `http://127.0.0.1:3200`
- Validates the exact `Host` and `Origin` headers
- Creates short-lived bridge sessions
- Signs requests with HMAC-SHA256
- Includes method, path, timestamp, nonce, and body hash in every signature
- Rejects expired timestamps and reused nonces
- Limits each session to five requests per second
- Temporarily locks clients after repeated authentication failures
- Limits request bodies to 4 KB
- Accepts JSON only for action endpoints
- Uses fixed presentation/media permission categories
- Supports emergency stop and explicit re-arm
- Writes rotating security events to `logs/security-audit.jsonl`
- Rejects unknown actions and arbitrary command strings
- Uses `execFile` with `shell: false`
- Does not use PowerShell `ExecutionPolicy Bypass`

## Allowlisted actions

- `next-slide`
- `previous-slide`
- `play-pause`
- `mute`
- `volume-up`
- `volume-down`
- `next-track`
- `previous-track`

## Emergency stop

Press:

```text
Ctrl + Shift + F12
```

The UI disarms gesture control, the bridge revokes sessions, and all Windows actions remain blocked until **Security Center → RE-ARM BRIDGE** is selected.

## Security testing

```powershell
npm run security:static
npm run security:bridge-test
npm run validate:compat
```

## Important behavior

Slide controls send left/right arrow keys to the active Windows application. Keep the intended PowerPoint or presentation window focused.

Stop the bridge using `Ctrl + C` in the terminal.
