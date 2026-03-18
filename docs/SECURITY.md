# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in WorkHub, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email us at **info@sikasio.com** with:

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fixes (optional)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix and disclosure**: Coordinated with the reporter

## Scope

The following are in scope:

- Authentication and authorization bypasses
- Data exposure or leakage
- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- Server-side request forgery (SSRF)
- SQL/NoSQL injection
- Firebase security rule bypasses

The following are **out of scope**:

- Vulnerabilities in third-party dependencies (report these upstream)
- Issues requiring physical access to a user's device
- Social engineering attacks
- Denial of service attacks

## Security Best Practices for Self-Hosting

When deploying WorkHub, ensure:

1. **Firebase Security Rules** are deployed (`npm run firebase:deploy:rules`)
2. **Environment variables** are kept secret and never committed to version control
3. **Firebase Authentication** is properly configured with appropriate sign-in methods
4. **Storage rules** are deployed to enforce file size and access limits
5. **Service account keys** are stored securely and rotated regularly

Thank you for helping keep WorkHub and its users safe.
