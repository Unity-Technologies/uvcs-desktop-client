# Smoke test (`npm run e2e`)

A light pass over the real built app, to catch what unit tests can't: wiring, startup, a view that fails to render.
`npm run e2e` runs it twice: over a development build (`electron-vite build --mode development`, React's development
build, as `npm run dev` serves it), then over the production build, which it leaves in `out/`; `npm run
e2e:development` and `npm run e2e:production` run one each, as CI's smoke jobs do, one per build. Each leaves its own build in
`out/`: after `e2e:development`, run `npm run build` before timing start-up or taking screenshots. The development build
is what catches a bug only `npm run dev` shows: StrictMode mounts every component, unmounts it and mounts it again,
so an effect whose cleanup leaves something its second run can't use (a WebGL canvas whose context was lost) fails
there, while the production build, which ships, runs each effect once. Each run builds, then `smoke.mjs` launches `out/` with Playwright's Electron driver and a throwaway
`--user-data-dir`, opens a Unity organization's page and a workspace, answers the question about profile pictures,
visits every sidebar view, a merge request's conversation with the larger comment editor opened over it (the panel,
not its backdrop, under a press at its middle) and the merge page its server's rules refuse, a merge with conflicts and
more changes than its list shows at once (a conflict, a change's diff; closed without merging), a file's history, the
repository at a changeset, the Branch Explorer's
timeline, a diff, a model diff (a 3D model's, in its worker), the `.meta` of a binary file, a diff in a new window, a branch's permissions, the
command palette and a link pasted in it, a session that ends and comes back, the repository explored without a
workspace (from the home screen: its views and a changeset's diff, in a window of its own too) and Settings, and switches to the dark theme. It
fails on any `pageerror` or `console.error`, a view whose heading doesn't show or that stays `Loading` (what shows
only: a view left while it loaded stays mounted, hidden by its `Activity`, with its skeleton until it shows again),
any `cm` command the fake couldn't answer, a server command while the sign-in screen covers the window, a step that
sent the same command line twice from the same folder ("Duplicate server commands" below), content cut off where
nothing scrolls ("Cut-off content" below), an answer to the profile pictures question that wasn't saved, and a kind of
page no step showed (`PAGES`, below). Beyond those and the larger editor being on top, it asserts only that things
appear, never pixels or copy.

About 14 seconds a run. It runs with reduced motion (`emulateMedia`, in every window it opens): the app's durations are
zero (`--duration-*`), so no step waits for a view's entrance or a dialog's, and the cut-off check measures boxes where
they rest. What runs only with motion on (a smooth scroll's glide, the model viewer's camera glide, a discarded line's
animation) isn't reached here; their decisions are unit-tested (`smoothScrollPlan`).

Screenshots of each step go to `<os temp>/uvcs-e2e-shots/<checkout>-<hash>`, one folder per checkout so
runs in several worktrees at once keep theirs (a failed step's is `NN-FAILED-<step>.png`), or to `<checkout>-<hash>`
in `UVCS_E2E_SHOTS` when set; on CI (`CI=true`) only a failed step's, the one the job keeps. A run empties its own folder as it starts, never the one around it. A failed step also
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
(`UVCS_FAKE_OFFICIAL_UPDATE`), it fails unless the update downloads in the background and Update brings the app to Home;
on Linux, unless the screen shows the command. No installer runs. The pinned bundles can't be served, so their
download is left to the unit tests, as is a declined permission (`OfficialClientUpdate`, `cmUpdateView`).

## What belongs here

The smoke test is a pass through the views that checks nothing explodes, plus what only the real app can show: the
wiring between main, preload and renderer, a second window, a worker, a canvas, real layout (what lies on top), a
session that ends across every layer. It runs on every pull request, on each OS and for both builds, so every step
costs that many times over. What a pure module decides (which items, labels, counts, keys, menus, ranking, what
reads the disk) is pinned by a unit test next to that module (CLAUDE.md "Tests are the quality gate"), not by a step
here: a step only opens what a new view or page adds and waits for it to settle. A new step says what in it a unit
test couldn't reach.

Every kind of page (`Page` in `app/navigation/pages.ts`) is in `PAGES`, and a step opens each one and waits for it
to show (`pageShown`, by the `data-page` its `PageFrame` carries); a run in which one never showed fails. A new kind
of page is one line there and a step that opens it, or `smokeOpensEveryPage.test.ts` fails. A step that opens a page
under a view whose list later steps use leaves it once its screenshot is taken (`step`'s `leave`): a view keeps its
pages, so going back to it would show the page again.

A step waits for what it is about to use before it types or presses a key, as a person would: the dialog open, the
result shown. Keys sent earlier land nowhere, and what a dialog reads when it opens (the palette's results) can take
seconds on a CI runner while it takes milliseconds locally: a step that doesn't wait passes on a laptop and fails now
and then on CI.

A run never takes the focus from the person working at the computer: both scripts launch the app with
`UVCS_BACKGROUND_WINDOWS=1`, as every launch of an agent's does (`windowsStayInBackground`), and every window then
shows without being activated (`showInactive`), never maximized or full screen, and nothing focuses it; the app saves
no window bounds or session. It may show over the person's window, but the keyboard stays theirs, and the app's icon
in the Dock or taskbar says a run is on. A window left behind others keeps running its timers and animation frames
(`backgroundThrottling` off) and drawing (`KEEP_COVERED_WINDOWS_DRAWING`: Chromium's occlusion check on Windows off).
Hidden windows were tried and dropped: on Windows a window never shown draws no frames, and each step waited for one.
An installed app ignores the variable, and only the scripts agents run set it (`backgroundWindows.test.ts`). So
nothing in a run may need the OS's focus: the window never has it, so `document.hasFocus()` may be false and an app
menu's accelerator never fires (a step presses keys the page handles). Nor may a step lead to a native dialog
(`dialog.showMessageBox`), which a person would have to answer. Nor may it need the window drawn on screen, which it
may not be (minimized, on another desktop, under a sleeping display): Playwright's `page.screenshot` waits for the
window to be drawn, and its timeout would fail whichever step it follows, so screenshots are taken from the frame
Electron holds (`screenshot`: `webContents.capturePage`), after two animation frames so the step's last change is in
it, and bounded by the same 15 s as every wait; never call `page.screenshot` in a step. Should a window not drawn stop
its animation frames, the screenshot fails its step in 15 s rather than hanging. The window's real content size is set
to the page's (`VIEWPORT`), so the frame copied holds the whole page.

It never touches UVCS infrastructure or the user's config: the only backend is the fake `cm` (`UVCS_CM_PATH`), the
workspace is a temp folder (`workspaceFixture.mjs`: `.plastic/plastic.selector` and a few files, one edited, one
private), the first-run import reads an empty `PLASTIC_HOME` (`plasticConfigFolder`), and Gravatar is off as on a
first run: the first people shown (Changesets' owners) bring up the question about profile pictures, which the run
answers "Not now" and, once the app quits, checks was saved (`gravatarChoiceAsked`), so nothing is ever sent.

Settings › Issue tracker shows its empty state: no tracker is connected, and none is reached. `fakeTrackers.cjs` is a
fake Jira Cloud and GitHub for looking at the trackers' flows in a development build (`UVCS_FAKE_TRACKERS`,
docs/features/issue-trackers.md "Seams the tests replace"); the smoke test doesn't load it.

## Duplicate server commands

The rule: the same command line, sent twice from the same folder, within one step, fails the run. Local commands are
left out (`needsServer`, held to the app's `needsSignIn` by its tests). The incoming check (`isIncomingCheck`) is the
one read on a timer, whose poll or check as the window gains focus may send it once more in any step: it may be sent
at most twice (`timesAllowed`), and a third time fails. The
logic is a module with its own tests (`duplicateReport`, `scripts/build/duplicateServerCommands.mts`); the smoke test
only writes each step's start into the fake's log, collects it, and reports, naming the step and the command.

A step ends once its reads did (`readsSettled`): the page marks itself while its query client reads or changes
anything, or a selection waits to settle before it reads (`<html data-reading>`, `markReadsInFlight`, `settleTimeout`),
and the step waits for the mark to clear and stay clear two frames later, when what the last answer showed has asked
for what it needs. A step waits so on every window it opened, before closing it, and the commands of all its windows
count together. A step that reads again on purpose names what does (`step(name, run, { rereads: 'Check again' })`),
and its commands aren't checked.

What it can't see: two reads of the same data written as different command lines (another `--format`, another
condition), and reads that start outside the query client and its settle waits, which may land in the next step.

`KNOWN_DUPLICATES` lists the duplicates still on `main`, each by its step and how its command line starts, with the
issue and the change that removes it; it allows that duplicate in that step only. One that no longer happens prints a
warning without failing, so that change can merge before or after the line goes; remove the line then. Never add a
line to get a new duplicate through: fix it, or name the issue that will.

## Cut-off content

The rule: after every step, nothing shown in a window's page or a dialog ends below the nearest box clipping it
(`overflow-y` other than `visible`), or below the window when none does, unless that box scrolls (`findCutOffContent`,
`cutOffContent.mjs`). Such content can't be read to its end: a list without its last rows, a diff without its
scrollbar, a button under the window's edge. The page windows a step opens are checked before it closes them.

Only downwards: sideways, the app cuts text on purpose (a cell's or a comment's ellipsis, its whole text a hover away),
so a box cut off on the right isn't checked.

It runs once the animations on what it checks end (loops like spinners, and a toast's countdown, aren't waited for),
and leaves out what isn't laid out to stay: what is still loading (a skeleton fills its box, cut where it ends), boxes
placed with `position: absolute` or `fixed` (a virtual list's rows, a popover), what screen readers alone read
(`.visually-hidden`, clipped to a pixel), and the overhang a box's own negative margin asks for (Settings' pane, room
for focus rings). Two pixels are rounding.

It catches only what overflows, so the fake's lists of pending changes, changesets and labels, and the diff of
`src/player.cs`, are longer than the window (`LONGER_THAN_THE_WINDOW` in `fakeCm/repository.cjs`): a view whose list
doesn't scroll fails. A new view or page whose content can grow shows enough of it to overflow.

`CUT_OFF_ALLOWED` lists what may end below its box, each by a selector and why. Never add one to get a step through:
a box cut off is a bug users see.

## The fake `cm` (`fakeCm/`)

- `cm.cjs` runs a command as a process (`cm find …`) or as `cm shell` (commands on stdin, each answer ending with
  `CommandResult <code>`, as `CmShellSession` reads it). Every command is logged to `UVCS_FAKE_CM_LOG`,
  one JSON line each: its arguments, the folder it ran in, and whether the fake knew it (`readCommandLog`).
- `answers.cjs` maps commands (`COMMANDS`, one or two words: `find`, `lock list`) to their output. `--format` output
  is the command's own template filled from the objects' fields (`format.cjs`), so a new field is one more property
  on the objects. `find` keeps only the objects its query's comparisons match
  (`where.cjs`); other conditions keep every object.
- `repository.cjs` is the synthetic repository: 3 branches, 48 changesets (one incoming, 40 of them a run of passes
  on one branch), 42 labels, a shelve, a code review, an attribute, a lock, the repository's and server's permissions
  (`showacl`), the workspace's files (45 pending changes) and the revisions `cm cat` and `cm diff` answer. The long
  lists are there for the cut-off check ("Cut-off content"). `status.cjs`
  answers `cm status --header --xml` and the changes as `--machinereadable` records, `tree.cjs` `cm ls --format=…`.
  `merge.cjs` is the one merge the fake previews, task-002 into task-001 on the server: its records as `cm merge
  --machinereadable --printcontributors` prints them, the listing of its files at its three changesets (`cm ls
  --tree=cs:N`) and their versions (`cm cat` by revision, item or path). Its 32 files, in `Assets/Lighting`, which the
  workspace hasn't, are a conflict to decide, one that merges by itself and 30 changes to apply: more than the list
  shows at the smoke test's window size. `history.cjs` answers `cm history --xml` and `cm find revision` with a
  workspace file's one revision, the one it loaded.
- A command, `find` object or `--format` field it doesn't know fails with exit code 1, naming it, and the smoke test
  fails listing it. A failure `cm` itself would give (`CmRefusal`: previewing a merge of task-001 or task-002 into main,
  which the fake's merge rules refuse) is an answer, not a command it doesn't know. **When a view starts running a new `cm` command, teach the fake**: add it to `COMMANDS`, with its
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
