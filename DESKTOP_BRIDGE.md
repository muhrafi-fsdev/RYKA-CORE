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
- Uses `execFile` (actions) and `spawn` (pointer helper), both with `shell: false`
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

## Pointer control (opt-in)

Pointer Mode moves the Windows cursor and presses the left mouse button from hand tracking. It is separate from the keyboard/media actions above and **off by default**.

- Requires the `pointer` permission (**Security Center → POINTER (MOUSE) CONTROL**). The permission is off every time the bridge starts and is revoked by emergency stop. The three permissions are independent.
- Uses its own route, `POST /pointer`, with the same Origin, Host, session, HMAC, nonce and timestamp checks as every other route. `/action` and its allowlist are unchanged.
- Body is exactly one of `{"op":"move","x":0..1,"y":0..1}`, `{"op":"down"}` or `{"op":"up"}`. `x` and `y` are fractions of the primary screen. Unknown operations, out-of-range or non-numeric values and extra fields are rejected with 400.
- Limited to 40 requests per second per session (the other routes keep 5). The browser sends at most about 25 moves per second.
- One fixed PowerShell helper stays running and reads a one-line protocol from stdin (`M x y`, `D`, `U`, `Q`). The bridge writes those lines itself from the validated numbers; request text never reaches the helper, which matches commands case-sensitively and never evaluates input.
- A button held while the browser goes quiet is released after 2 seconds. The helper stops after 10 seconds without requests, after the permission is withdrawn, on emergency stop and when the bridge exits.
- The UI shows **POINTER ACTIVE** and ends the mode when the camera stops, the bridge locks or goes offline, the permission is withdrawn, or no hand is seen for 5 seconds.
- Only the lifecycle and button events are written to the audit log, not every move.
- Windows only; other platforms answer 501.

## Emergency stop

Press:

```text
Ctrl + Shift + F12
```

The UI disarms gesture control, the bridge revokes sessions and the pointer permission, the pointer helper is stopped (a held mouse button is released first), and all Windows actions remain blocked until **Security Center → RE-ARM BRIDGE** is selected.

## Security testing

```powershell
npm run security:static
npm run security:bridge-test
npm run validate:compat
```

## Important behavior

Slide controls send left/right arrow keys to the active Windows application. Keep the intended PowerPoint or presentation window focused.

Stop the bridge using `Ctrl + C` in the terminal.
