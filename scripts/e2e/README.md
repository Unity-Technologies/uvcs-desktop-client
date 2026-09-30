# Smoke test (`npm run e2e`)

A light pass over the real built app, to catch what unit tests can't: wiring, startup, a view that fails to render.
`npm run e2e` builds, then `smoke.mjs` launches `out/` with Playwright's Electron driver and a throwaway
`--user-data-dir`, opens a workspace, visits every sidebar view, a diff, the command palette and Settings, and switches
to the dark theme. It fails on any `pageerror` or `console.error`, a view whose heading doesn't show or that stays
`Loading`, and any `cm` command the fake couldn't answer. It asserts only that things appear, never pixels or copy.
About 10 seconds. Screenshots of each step go to `<os temp>/uvcs-e2e-shots` (a failed step's is `NN-FAILED-<step>.png`).

It never touches UVCS infrastructure or the user's config: the only backend is the fake `cm` (`UVCS_CM_PATH`), the
workspace is a temp folder (`workspaceFixture.mjs`: `.plastic/plastic.selector` and a few files, one edited, one
private), the first-run import reads an empty `PLASTIC_HOME` (`plasticConfigFolder`), and Gravatar is off.

## The fake `cm` (`fakeCm/`)

- `cm.cjs` runs a command as a process (`cm find …`) or as `cm shell` (commands on stdin, each answer ending with
  `CommandResult <code>`, as `CmShellSession` reads it). Every command is logged to `UVCS_FAKE_CM_LOG`, `ok` or `ERR`.
- `answers.cjs` maps commands (`COMMANDS`, one or two words: `find`, `lock list`) to their output. `--format` output
  is the command's own template filled from the objects' fields (`format.cjs`), and `find --xml` prints every field,
  so a new field is one more property on the objects. `find` keeps only the objects its query's comparisons match
  (`where.cjs`); other conditions keep every object.
- `repository.cjs` is the synthetic repository: 3 branches, 8 changesets (one incoming), 2 labels, a shelve, a code
  review, an attribute, a lock, the workspace's files and the revisions `cm cat` and `cm diff` answer. `status.cjs`
  answers `cm status --xml`, `tree.cjs` `cm ls --xml`.
- A command, `find` object or `--format` field it doesn't know fails with exit code 1, naming it, and the smoke test
  fails listing it. **When a view starts running a new `cm` command, teach the fake**: add it to `COMMANDS`, with its
  objects in `repository.cjs`, output shaped as the app's parser reads it (its tests show real `cm` output).
- Windows starts only executables (Node refuses a `.cmd` without a shell), so there `executable.mjs` builds `cm.exe`
  with `node --build-sea` (Node 25.5 or later) that loads `cm.cjs`; on macOS and Linux the script runs by its `#!`.

## CI

`.github/workflows/ci.yml` runs it on macOS and Windows (Node 26, `npm ci`, `npm run e2e`). Linux has no display
there: run it under `xvfb-run -a npm run e2e`.
