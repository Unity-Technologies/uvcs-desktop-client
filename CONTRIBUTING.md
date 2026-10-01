# Contributing

Issues and pull requests are welcome. For anything larger than a fix, open an issue first so we can agree on the
design before you build it.

## All contributions are subject to the [Unity Contribution Agreement (UCA)](https://unity.com/legal/licenses/unity-contribution-agreement)

By making a pull request, you are confirming agreement to the terms and conditions of the UCA, including that your
Contributions are your original creation and that you have complete right and authority to make your Contributions.

When you open your first pull request, a bot (CLA Assistant) asks you to accept the UCA, as an individual or on
behalf of your company. A pull request is merged only once it's accepted.

## Before you open a pull request

1. Read [CLAUDE.md](CLAUDE.md) (the rules every change follows) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
   (how the code is organized), then the doc of the area you touch in `docs/features/`.
2. Ship tests with the change, and update the docs it makes untrue.
3. Make sure `npm run typecheck` and `npm test` pass. For a change to startup, navigation or many views, run
   `npm run e2e` too. CI runs them on macOS, Windows and Linux.
4. Check anything visible in the running app, in both themes.

## Never write to real data

Anything that writes (checkin, merge, delete) runs against a sandbox on a local server only: `scripts/sandboxes/`
creates one. Never test against your team's server or workspaces.

## Commits

One logical change per commit, and a message that says what the user can now do or see ("Commits: let the history
tell the story" in CLAUDE.md).
