# RYKA CORE Security Policy

## Supported version

Security fixes are maintained for the newest RYKA CORE release only.

| Version | Supported |
|---|---|
| 4.4.x | Yes |
| 4.2.x | Security fixes only |
| 4.1.x and older | No |

## Reporting a vulnerability

Do not publish exploitable details in a public issue. Send a private report to the project owner and include:

- Affected version and file
- Reproduction steps
- Expected impact
- Proof of concept with destructive actions removed
- Suggested remediation, when available

Never include real API keys, passwords, personal data, or active access tokens in a report.

## Security boundaries

RYKA CORE only permits explicitly allowlisted Windows actions. Raw shell commands, arbitrary PowerShell, file deletion, process termination, and untrusted command strings are outside the supported security model and must remain blocked.
