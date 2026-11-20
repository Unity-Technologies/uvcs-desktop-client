# Smoke test (`npm run e2e`)

A light pass over the real built app, to catch what unit tests can't: wiring, startup, a view that fails to render.
`npm run e2e` runs it twice: over a development build (`electron-vite build --mode development`, React's development
build, as `npm run dev` serves it), then over the production build, which it leaves in `out/`. The development build
is what catches a bug only `npm run dev` shows: StrictMode mounts every component, unmounts it and mounts it again,
so an effect whose cleanup leaves something its second run can't use (a WebGL canvas whose context was lost) fails
there, while the production build, which ships, runs each effect once. Each run builds, then `smoke.mjs` launches `out/` with Playwright's Electron driver and a throwaway
`--user-data-dir`, switches the home screen between two Unity accounts (each lists only its organizations), opens a workspace, answers the question about profile pictures, visits every sidebar view, the larger comment editor opened over a merge request's conversation (the panel, not its backdrop, under a press at its middle), a diff, a file's last change read from the disk (the fake's revision is another file's), against its parent revision too, a model diff (a 3D model's, in its worker), a branch's permissions (an edit, then discarded), the command palette (a prefix narrowing it to people, and a link pasted in it), the repository explored without a workspace
(from the home screen: its views, a file found by name and a changeset's diff) and Settings, and switches
to the dark theme. It fails on any `pageerror` or `console.error`, a view whose heading doesn't show or that stays
`Loading` (what shows only: a view left while it loaded stays mounted, hidden by its `Activity`, with its skeleton
until it shows again), any `cm` command the fake couldn't answer, and an answer to the profile pictures question that wasn't
saved. Beyond that answer and the larger editor being on top, it asserts only that things appear, never pixels or copy.
About 10 seconds a run. Screenshots of each step go to `<os temp>/uvcs-e2e-shots/<checkout>-<hash>`, one folder per checkout so
runs in several worktrees at once keep theirs (a failed step's is `NN-FAILED-<step>.png`), or to `<checkout>-<hash>`
in `UVCS_E2E_SHOTS` when set. A run empties its own folder as it starts, never the one around it. A failed step also
prints Playwright's call log, what it was waiting for when it gave up, and a view that never settles names each
element still loading (`stillLoading`): a run that fails now and then can be read only from its output.

After each smoke test, `setupScreen.mjs` runs the app's first run with no `cm` of its own (docs/features/cm-runtime.md):
an empty store in a temp folder (`HOME`, `LOCALAPPDATA`, `XDG_DATA_HOME`), a local download site answering 404, and the
fake `cm` on the PATH as the installed one. It fails unless the window starts on the setup screen, nothing asks `cm`
for more than its version meanwhile, and "Use the installed one" brings the app to Home and saves that choice. The
pinned bundles can't be served, so the download itself is left to the unit tests.

A step waits for what it is about to use before it types or presses a key, as a person would: the dialog open, the
result shown. Keys sent earlier land nowhere, and what a dialog reads when it opens (Go to file's paths) can take
seconds on a CI runner while it takes milliseconds locally: a step that doesn't wait passes on a laptop and fails now
and then on CI.

Nothing in a run may need the window drawn on screen. The OS draws no window that is minimized, hidden, on another
desktop or under a sleeping display, though the page still renders and every step passes; and a busy machine runs
agents' smoke tests where nobody looks. Playwright's `page.screenshot` waits for the window to be drawn, and its
timeout would fail whichever step it follows, so screenshots are taken from the frame Electron holds (`screenshot`:
`webContents.capturePage`), after two animation frames so the step's last change is in it, and bounded by the same
15 s as every wait; never call `page.screenshot` in a step. That a minimized or hidden window still runs animation
frames was checked on macOS only; elsewhere, should it not, the screenshot fails its step in 15 s rather than hanging.
The window's real content size is set to the page's (`VIEWPORT`), so the frame copied holds the whole page.

It never touches UVCS infrastructure or the user's config: the only backend is the fake `cm` (`UVCS_CM_PATH`), the
workspace is a temp folder (`workspaceFixture.mjs`: `.plastic/plastic.selector` and a few files, one edited, one
private), the first-run import reads an empty `PLASTIC_HOME` (`plasticConfigFolder`), and Gravatar is off as on a
first run: the first people shown (Changesets' owners) bring up the question about profile pictures, which the run
answers "Not now" and, once the app quits, checks was saved (`gravatarChoiceAsked`), so nothing is ever sent.

Settings › Issue tracker shows its empty state: no tracker is connected, and none is reached. `fakeTrackers.cjs` is a
fake Jira Cloud and GitHub for looking at the trackers' flows in a development build (`UVCS_FAKE_TRACKERS`,
docs/features/issue-trackers.md "Seams the tests replace"); the smoke test doesn't load it.

## The fake `cm` (`fakeCm/`)

- `cm.cjs` runs a command as a process (`cm find …`) or as `cm shell` (commands on stdin, each answer ending with
  `CommandResult <code>`, as `CmShellSession` reads it). Every command is logged to `UVCS_FAKE_CM_LOG`, `ok` or `ERR`.
- `answers.cjs` maps commands (`COMMANDS`, one or two words: `find`, `lock list`) to their output. `--format` output
  is the command's own template filled from the objects' fields (`format.cjs`), so a new field is one more property
  on the objects. `find` keeps only the objects its query's comparisons match
  (`where.cjs`); other conditions keep every object.
- `repository.cjs` is the synthetic repository: 3 branches, 8 changesets (one incoming), 2 labels, a shelve, a code
  review, an attribute, a lock, the repository's and server's permissions (`showacl`), the workspace's files and the revisions `cm cat` and `cm diff` answer. `status.cjs`
  answers `cm status --header --xml` and the changes as `--machinereadable` records, `tree.cjs` `cm ls --format=…`.
- A command, `find` object or `--format` field it doesn't know fails with exit code 1, naming it, and the smoke test
  fails listing it. A failure `cm` itself would give (`CmRefusal`: previewing a merge of task-001 or task-002, which
  the fake's merge rules refuse) is an answer, not a command it doesn't know. **When a view starts running a new `cm` command, teach the fake**: add it to `COMMANDS`, with its
  objects in `repository.cjs`, output shaped as the app's parser reads it (its tests show real `cm` output).
- `signIn.cjs` ends a server's session (docs/features/accounts.md): `UVCS_FAKE_CM_SIGN_IN` names a file, read on every
  command, holding the server's name (and ` prompt` to have `cm` ask which system to sign in with, as it does once it
  can't renew a sign-in, instead of printing its "auth token expired" sentence). While it does, every command to that
  server but the local ones fails so (`cm status` too, unless `--compact`, as it asks the server for the workspace's
  header). The smoke test writes it to see one sign-in screen, no server command while it
  shows, and the views back after Check again.
- Windows starts only executables (Node refuses a `.cmd` without a shell), so there `executable.mjs` builds `cm.exe`
  with `node --build-sea` (Node 25.5 or later) that loads `cm.cjs`; on macOS and Linux the script runs by its `#!`.

## CI

`.github/workflows/ci.yml` runs it on macOS and Windows (Node 26, `npm ci`, `npm run e2e`). Linux has no display
there: run it under `xvfb-run -a npm run e2e`. A failed run keeps its screenshots as the job's artifact
`smoke-screenshots-<job>`.
