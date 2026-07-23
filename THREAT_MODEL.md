# RYKA CORE 4.4 Threat Model

## Assets

- Webcam stream and hand landmarks
- Gesture-to-action mappings
- Windows desktop-control capability
- Runtime session keys
- Operator preferences and action logs

## Trust boundaries

1. Browser UI to local Secure Desktop Bridge
2. Gesture recognition to action validation
3. Node bridge to PowerShell and Windows APIs
4. Third-party npm dependencies and remote MediaPipe assets

## Primary threats and mitigations

| Threat | Mitigation |
|---|---|
| Cross-origin website calls the bridge | Exact Origin and Host allowlists |
| Captured request is replayed | Timestamp window and one-time nonce |
| Request is modified | HMAC-SHA256 signature over method, path, timestamp, nonce, and body hash |
| Action flooding | Per-session rate limit and temporary client lockout |
| Arbitrary command injection | Fixed action allowlist and `execFile`; no raw shell input |
| PowerShell policy weakening | `ExecutionPolicy Bypass` removed |
| Gesture repeats unexpectedly | Confidence threshold, voting, hold, release gate, and cooldown |
| Emergency loss of control | Ctrl+Shift+F12 emergency stop and server-side lock |
| Secret committed to source | Security self-check, `.gitignore`, CodeQL/dependency workflows |
| Vulnerable package introduced | Exact direct versions, npm audit, Dependency Review, Dependabot |
| Framing or content-type attacks | CSP, frame denial, nosniff, no-store, permissions policy |

## Residual risks

- A compromised browser process or injected same-origin script can access runtime session material.
- Remote MediaPipe resources remain a supply-chain dependency until the model and WASM assets are vendored and checksum-verified.
- The current bridge is development-oriented; a future Tauri/Rust migration will remove the localhost HTTP boundary.


## Accessibility and Communication Data

### Assets

- Personal gesture-to-phrase mappings.
- Communication history and favorites.
- Live caption text.
- Microphone permission state.

### Threats and mitigations

- **Accidental message output:** confirmation mode, hold validation, confidence threshold, cooldown, and release-required.
- **Sensitive local history exposure:** history can be disabled or cleared; storage remains local.
- **Unexpected microphone use:** explicit start/stop controls and visible active states.
- **Misleading accessibility claims:** documentation states that RYKA Access is not a BISINDO/SIBI translator or medical device.
- **Emergency false activation:** emergency screen requires explicit phrase selection; no automatic calls or location sharing.
- **Caption inaccuracies:** UI labels live caption as browser-dependent and allows manual fallback.

## RYKA Access 4.4 data and accessibility threats

| Threat | Impact | Mitigation |
|---|---|---|
| Malicious or malformed imported profile | Broken settings, unexpected UI behavior, oversized data | Import file size limit, allowlisted fields, type checks, numeric clamping, known gesture/input/role values only |
| Sensitive caption or communication history remains on device | Privacy exposure | Private Session, separate clear controls, configurable auto-delete, local-only storage |
| Partner Display exposes private messages to people nearby | Shoulder surfing | User-controlled fullscreen activation, immediate Escape close, no automatic opening |
| Printed communication card exposes personal information | Offline privacy exposure | User initiates export/print, preview is generated locally, documentation tells user to review content |
| Single-switch or dwell triggers the wrong phrase | Incorrect communication | Visible scanning highlight, adjustable interval/dwell duration, confirmation available for gesture messages |
| Emergency phrase interpreted as diagnosis | Unsafe medical assumption | Clear limitation notice: communication aid only, no diagnosis, call, or automatic location sharing |
