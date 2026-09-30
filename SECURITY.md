# Security

## Reporting a vulnerability

Please don't open a public issue for a security problem. Report it privately through GitHub:
[Security ▸ Report a vulnerability](https://github.com/danipen/uvcs-desktop-client/security/advisories/new).

Say what an attacker could do, the version (About ▸ Copy Details) and the steps to reproduce it. You'll get an answer
on the report, and the fix ships as a new release, which every installed app updates to by itself.

## Supported versions

Only the latest release gets fixes.

## Scope

The app runs the `cm` command line for every operation and has no server of its own. A problem in Unity Version
Control itself (the server, `cm`, the official clients) goes to Unity, not here.
