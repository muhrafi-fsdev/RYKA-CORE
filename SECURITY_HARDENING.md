# RYKA CORE 4.4 Security Baseline (retained from 4.2)

## Implemented controls

- Random 256-bit bootstrap token generated for every desktop launch
- Short-lived authenticated bridge sessions
- HMAC-SHA256 signed requests
- Timestamp validation and nonce replay protection
- Strict Origin and Host validation
- Five-request-per-second rate limiting
- Temporary lock after repeated authentication failures
- 4 KB request-body limit and JSON validation
- Server-side presentation/media permission switches
- Emergency stop and explicit re-arm flow
- Local JSONL security audit log with rotation
- Fixed Windows action allowlist
- `execFile` with `shell: false`; no arbitrary command strings
- PowerShell `ExecutionPolicy Bypass` removed
- Browser CSP and secure development headers
- Exact direct dependency versions and Dependabot policy
- CodeQL, Dependency Review, Gitleaks, npm audit, tests, and build workflows
- Local security self-check script

## Emergency control

Press `Ctrl + Shift + F12` while the RYKA CORE window is active. Desktop actions are immediately locked, current gesture control is disarmed, and bridge sessions are revoked. Use **Security Center → RE-ARM BRIDGE** to restore signed actions.

## Audit log

Security events are written locally to:

```text
logs/security-audit.jsonl
```

The log does not record session secrets or bootstrap tokens.
