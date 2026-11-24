# Smoke test (`npm run e2e`)

A light pass over the real built app, to catch what unit tests can't: wiring, startup, a view that fails to render.
`npm run e2e` runs it twice: over a development build (`electron-vite build --mode development`, React's development
build, as `npm run dev` serves it), then over the production build, which it leaves in `out/`; `npm run
e2e:development` and `npm run e2e:production` run one each, as CI's smoke jobs do, one per build. Each leaves its own build in
`out/`: after `e2e:development`, run `npm run build` before timing start-up or taking screenshots. The development build
is what catches a bug only `npm run dev` shows: StrictMode mounts every component, unmounts it and mounts it again,
so an effect whose cleanup leaves something its second run can't use (a WebGL canvas whose context was lost) fails
there, while the production build, which ships, runs each effect once. Each run builds, then `smoke.mjs` launches `out/` with Playwright's Electron driver and a throwaway
`--user-data-dir`, switches the home screen between two Unity accounts (each lists only its organizations), opens a workspace, answers the question about profile pictures, clicks a changeset's comment's chips (a changeset, and a change request no review read yet, which must open at its thread, in view), visits every sidebar view, the larger comment editor opened over a merge request's conversation (the panel, not its backdrop, under a press at its middle), a diff, a file's last change read from the disk (the fake's revision is another file's), against its parent revision too, a model diff (a 3D model's, in its worker), a branch's permissions (an edit, then discarded), the command palette (a prefix narrowing it to people, and a link pasted in it), the repository explored without a workspace
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

After each smoke test, `setupScreen.mjs` runs the screens that stand in for the app while its `cm` can't run yet
(docs/features/cm-runtime.md), each launch with an empty store in a temp folder (`HOME`, `LOCALAPPDATA`,
`XDG_DATA_HOME`), a local download site answering 404, and the fake `cm` on the PATH as the installed one. The setup
screen: with the app's own chosen, it fails unless the window starts on the setup screen, nothing asks `cm` for more
than its version meanwhile, and "Use the Installed Version" brings the app to Home and saves that choice. The
update screen: with the default choice and the fake reporting an older version, it fails unless the update screen
shows, and checking again (Check Again on Linux, the window gaining focus elsewhere), once the fake reports the pinned
version, brings the app to Home. Updating the installed one: with a fake of Unity's download site
(`fakeOfficialSite.mjs`, `UVCS_OFFICIAL_UPDATES_URL`) and the development build's fake installer
(`UVCS_FAKE_OFFICIAL_UPDATE`), it fails unless the update downloads in the background, Update brings the app to Home,
and a declined permission says it couldn't update; on Linux, unless the screen shows the command. No installer runs.
The pinned bundles can't be served, so their download is left to the unit tests.

A step waits for what it is about to use before it types or presses a key, as a person would: the dialog open, the
result shown. Keys sent earlier land nowhere, and what a dialog reads when it opens (Go to file's paths) can take
seconds on a CI runner while it takes milliseconds locally: a step that doesn't wait passes on a laptop and fails now
and then on CI.

On macOS its windows are never shown, so a run never takes the focus from the person working at the computer: both
scripts launch the app with `UVCS_HIDDEN_WINDOWS=1` (`windowsStayHidden`), and every window then opens and renders
hidden, with its timers and animation frames running (`backgroundThrottling` off). Its icon stays in the Dock while it
runs, so a person can tell a run is on; with no window shown, the app never becomes the active one. On Windows and
Linux the windows show as always: a window never shown on Windows draws no frames, so each step waited for one and a
run took five times as long on CI. An installed app ignores it, and only these two scripts set it
(`hiddenWindows.test.ts`). So nothing in a run may need the window drawn on screen, nor the OS's focus: on macOS the
window never has it, so `document.hasFocus()` may be false and an app menu's accelerator never fires (a step presses
keys the page handles). Nor may a step lead to a native dialog (`dialog.showMessageBox`): attached to a window never
shown, it would wait for ever instead of failing. Playwright's `page.screenshot` waits for the window to be drawn, and
its timeout would fail whichever step it follows, so screenshots are taken from the frame Electron holds
(`screenshot`: `webContents.capturePage`), after two animation frames so the step's last change is in it, and bounded
by the same 15 s as every wait; never call `page.screenshot` in a step. That a hidden window still runs animation
frames and renders its frame (WebGL too) was checked on macOS only; elsewhere, should it not, the screenshot fails its
step in 15 s rather than hanging. The window's real content size is set to the page's (`VIEWPORT`), so the frame
copied holds the whole page.

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
- `UVCS_FAKE_CM_VERSION_FILE` names a file, read on every command, holding the version `cm version` prints (the pinned
  one when there's none): an installed `cm` older than the app needs, for the update screen. In a development build,
  the fake on a temp PATH with such a file (and without `UVCS_CM_PATH`) shows that screen for Playwright too.
- `signIn.cjs` ends a server's session (docs/features/accounts.md): `UVCS_FAKE_CM_SIGN_IN` names a file, read on every
  command, holding the server's name (and ` prompt` to have `cm` ask which system to sign in with, as it does once it
  can't renew a sign-in, instead of printing its "auth token expired" sentence). While it does, every command to that
  server but the local ones fails so (`cm status` too, unless `--compact`, as it asks the server for the workspace's
  header). The smoke test writes it to see one sign-in screen, no server command while it
  shows, and the views back after Check again.
- Windows starts only executables (Node refuses a `.cmd` without a shell), so there `executable.mjs` builds `cm.exe`
  with `node --build-sea` (Node 25.5 or later) that loads `cm.cjs`; on macOS and Linux the script runs by its `#!`.

## CI

`.github/workflows/ci.yml` runs it on macOS and Windows x64, in jobs of their own beside the tests: one per build
(`npm run e2e:development`, `npm run e2e:production`). Linux has no display there: run it under `xvfb-run -a npm run
e2e`. A failed run keeps its screenshots as the job's artifact `smoke-screenshots-<platform>-<build>`.
