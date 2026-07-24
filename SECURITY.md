# Security Policy

Shift Schedule Builder is a static, no-backend web app: no server, no database,
no accounts. The attack surface is small, but reports are still very welcome.

## Reporting a vulnerability

**Please don't open a public issue for a security problem.** Instead, open a
private report through GitHub:

> Repository **Security** tab → **Report a vulnerability**
> ([direct link](https://github.com/bhavinvirani/Scheduler/security/advisories/new))

I'll aim to acknowledge within a few days, fix confirmed issues as quickly as is
practical, and credit you in the release notes if you'd like.

## What's in scope

Anything that lets untrusted input run script, exfiltrate data, or corrupt a
schedule, for example:

- a crafted **share link** (`#r=…`) or hand-edited `localStorage` blob that
  escapes the `isValidSchedule` guard,
- stored or reflected script (XSS) through a name, title, or shift value.

Out of scope: issues that require an already-compromised browser, a malicious
extension, or physical access to the device.

## Supported versions

The version currently deployed to GitHub Pages is the only supported version.
