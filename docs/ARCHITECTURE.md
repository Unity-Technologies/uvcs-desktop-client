# Architecture

A desktop client for Unity Version Control. The only backend is the `cm` CLI.

```
src/
  shared/     Types shared by both processes: domain model, API contract, events. No runtime deps.
  main/       Electron main process. Talks to `cm`, the file system and the OS.
  preload/    Exposes `window.uvcs` (invoke + events) to the renderer. Nothing else.
  renderer/   React UI.
```

## How a request flows

1. A component calls `api.<area>.<method>(...)` (`renderer/src/api/client.ts`), a typed proxy of `UvcsApi` (`shared/api`).
2. The preload forwards it over one IPC channel; `main/ipc/registerApi.ts` dispatches to the service.
3. Services (`main/services/<area>Service.ts`) build `cm` arguments and parse the output with helpers in `main/cm/`.
4. `CmClient` runs the command:
   - `query()` for short reads: reuses pooled `cm shell` sessions (much faster than spawning `cm`), two per working
     directory; a command takes the first one free, and a directory idle for ten minutes lets its sessions go.
     A workspace no window shows anymore lets them go once their commands are done (`WorkspaceWatchers` `onStopped`).
     A session takes about a second to answer its first command, so until one in that directory has, the query runs as a
     process of its own.
   - `execute()` for long or cancellable work (update, switch, checkin, merge): a dedicated process that streams progress lines.
   - A command line too long to start a process with (a checkin or shelve of thousands of paths: Windows takes 32,767
     characters, quotes included) is written to a `cm shell` of its own instead (`processCommand`): still one command, never split.
     So is, on Windows, a command that prints text (see Parsing).
   - A pooled command may take two minutes, a workspace write (undo, add, checkout of thousands of files) half an hour.
5. Every command is logged and pushed to the window whose call ran it (`commandLogged`), shown in the command log panel.

## Parsing `cm` output

- Prefer `--xml` (`parseXml`) or `--format` with `recordFormat`/`parseRecords` (control-character separators; no ambiguity with paths or comments).
- Never parse human-readable output when a machine format exists.
- Multi-line text (comments) goes through temp files (`-commentsfile`); `cm shell` cannot take quotes or newlines in arguments.
- A `cm shell` command ends at the `CommandResult <code>` line that ends its output, with nothing more in the pipe
  (`CmShellSession`): comments can quote such lines, and a misread end shifts every later command by one output.
- Text crosses as UTF-8 on every OS: `cm shell --encoding=utf-8` reads commands so (Windows would read them in the
  console's code page), and `find` and `--xml` output is asked for in UTF-8 (`withUtf8Output`). Other output of a
  process comes in the console's code page on Windows (437, 850: other scripts become `?`), while a `cm shell` prints
  it in UTF-8, so there a process that prints text (diffs, merges, updates, logs) runs as a `cm shell` of its own
  (`processCommand`, `printsInConsoleCodePage`); only error messages stay in the code page. Windows' CRLF becomes LF before any parser sees the output, and relative paths
  in `cm status --xml` get forward slashes.
- On macOS `cm` reads names decomposed (NFD), as it reports them: local paths go to it so (`inCmPathForm`), or
  `cm checkin` of a composed `é.txt` finds no change. Branch names, queries and server paths are left as written.

## Operation progress

Long operations report a structured `OperationProgress` (`shared/domain/operation.ts`): a stage (`preparing`,
`calculating`, `downloading`, `uploading`, `applying`, `confirming`, `finishing`, or `working` in the app's words),
stable stage words, files and bytes done and to do, a fraction (or null), the file at hand, whether stopping is still
safe, and the step of a multi-command operation (shelve, undo, switch, bring). Never a raw `cm` line.

- Each command's output is read by a pure `ProgressReader` (`main/cm/progress/`), passed as
  `onOutputLine: context.progressOf(reader)`; the `OperationTracker` adds the step (`context.beginStep`) and throttles to
  ten reports a second, stage changes at once.
- `cm update`/`cm switch` run with `--forcedetailedprogress` (`cm/updateArgs.ts`): `cm` prints its bytes-and-files line
  only to a terminal otherwise, and `--machinereadable` turns it off. It rewrites the line with `\r` every 200 ms, so
  `runCmProcess` splits lines at `\r` too. The words are localized: readers go by the line's shape. Its percentage
  goes by bytes and it writes big files first (99% with 1 of 8,001 files written), so the fraction weighs each file as
  128 KB more than its bytes; where the percentage shows beside one measure, the other is at hand (card, tooltip).
- `cm checkin --machinereadable` reports uploaded bytes only every 5 s with redirected output; `cm merge` prints its plan,
  then a record per change applied in a burst, then downloads silently; `cm shelveset create` only names its stages.
- Stopping is offered only while it leaves things as they were: a killed update or switch leaves the workspace half
  updated with partial files as private `.private.0` copies, and a checkin killed while confirming may be half recorded;
  killed while uploading, nothing is committed.
- The renderer keeps each operation's progress and its bar motion (`runningOperationsStore`, `progressBar`): the bar
  glides linearly towards where the next report should land at the current pace (never backwards, at most halfway into
  what's left), sweeps while nothing is measured, and stays full and shimmering while wrapping up, all of it moved
  by transforms on the compositor. `OperationCard` draws it in fixed rows and widths, then turns into the success
  message in place; the status bar, the branch pill (a switch) and the incoming chip (an update) show the same
  operation with a `ProgressRing`. A report renders only these (`useRunningOperationOfKind` for the pill and the chip).

## No external tool opens by itself

`cm` never opens its merge or diff tool, and background work never opens anything. A merge tool opens only when the
user asks for it on one conflicting file ("Resolve in…") or on each in turn ("Resolve N conflicts in…"), one at a time,
and the app keeps the decision.

- `cm merge --merge` always carries `--nointeractiveresolution` and an explicit decision for every conflicting file
  (`fileConflictArgs`): workspace merges keep the destination and the app writes the resolutions; merges into a
  server branch keep one side for all files.
- Shelves are applied as merges from `sh:N` (never `cm shelveset apply`); `cm update` keeps `--dontmerge`;
  `cm diff` always has `--format`. `main/cm/noExternalUi.test.ts` checks these statically, and that processes start
  only to run `cm`, open a terminal, or from `main/merge/mergeTools/launch.ts`, imported only by `mergeToolsService`.
- `cm` processes run with stdin closed, so a console prompt fails instead of hanging.

## Merge tools

`cm` has no way to run its merge tool for one chosen conflict (`--resolveconflict` is for directory conflicts only;
`--merge` runs it for every file), so the app runs the tool itself, per file (`main/merge/mergeTools`):

- Found per OS (`knownTools`, `detectTools`): the UVCS merge tool (the Desktop GUI run as `xmerge`: `macplasticx` in PlasticSCM.app, `plastic.exe` next to `cm.exe`, `plasticgui`), VS Code and its forks,
  JetBrains IDEs, Sublime Merge, KDiff3, Beyond Compare, Meld, P4Merge, Araxis and FileMerge (`opendiff`, only with
  Xcode) and WinMerge on Windows, each with the three-way command line of its docs (cross-checked with Git's `mergetools/*`). client.conf's text merge tools that aren't the UVCS one are offered too, by extension
  (`clientConfMergeTools`), and the user can add any program with an arguments template (`{base}` `{yours}`
  `{incoming}` `{result}` and their `…Name`s). Settings keep the preferred tool (`auto`: the UVCS one, else the first
  found), the user's tools and per-tool arguments.
- `mergeTools.resolve` saves the three versions to temp files named after the file (`a.BASE.ts`...), writes the result
  file with the file as it stands in the app (the automatic merge with its markers, or the user's picks), runs the
  tool without a shell (`.cmd` launchers through `cmd.exe`, arguments quoted), and waits. Few tools tell saving from
  cancelling by their exit code, so the result file decides (`judgeToolResult`): unchanged means nothing was resolved;
  saved text becomes the file's decision (markers left count as conflicts left). Text files only: no tool really
  merges binaries, so a binary keeps one of its versions, picked in the app (`canMergeIn`). "Stop waiting" kills the tool process and takes what was saved so far, as soon as it exits: a launcher's
  app still holding its output doesn't keep the file open.
- The workspace is never touched: the outcome is a decision like any other, written when the merge completes.

## Merge page

The merge page (`features/merge`) is a preview until "Complete merge". Its header is one row: a "Preview" pill (its
tooltip: nothing is written until then), the title fitted as a whole (`fitMergeTitle`: the words stay, the branches give
way from their middle), the changesets it combines ("cs:3 → cs:5"; a click lists them with the base), where it stands
("2 conflicts to decide", the full summary in its tooltip) and Complete merge, the primary action only once nothing waits.
Every status reads as what the merge will do, never as done (`mergeStatus`): "Will merge automatically", "Needs your
decision", then the user's choice ("Keeping yours", "Keeping incoming", "Combined", "Edited by you"; "Open in VS Code…",
"Resolved in VS Code" for merge tools): an icon in the list and a chip in the file's toolbar, with a short tooltip. Sides
are "Yours"/"Incoming" in a workspace and "Destination"/"Source" when merging into a server branch (`mergeLabels`), always
next to their branch. Copy stays short: labels name things, tooltips define them, no sentence restates what the page shows.

While two files or more wait for a decision the preferred tool can open, the header's primary action is "Resolve N
conflicts in <tool>" (`ResolveRunControl`, ⇧⌘↩; the caret picks another tool, with how many files each opens, and
whether a file closed unsaved asks before the next): the files open one after the other, each once the one before is
saved and closed (`useResolveRun`, `resolveRun`). Files the tool can't open (binaries, types it isn't for) are left
out and named in its tooltip. While it runs, a strip takes the status's place: a step per file, "Resolving 2 of 5 ·
app.ts in <tool>", Skip this file (closes it there) and Stop (Esc, confirmed while the tool has a file). The list marks
the file open and the selection follows it unless the user looks elsewhere, which never stops the run; files decided in
the app meanwhile are skipped, a file closed unsaved keeps "Needs your decision" and pauses the strip ("closed without
saving", Next file / Stop) unless the setting says to go on, and a tool that can't start stops the run with its reason.
A toast sums it up ("Resolved 4 of 5 in <tool>", "1 still needs you") and focus goes to the first file still waiting,
or to Complete merge. With one file left, its own toolbar is the way.

A conflicting file is read-only. Its toolbar holds the file, its status and the ways out: "Resolve in <tool>"
(`MergeToolButton`, a split button, primary while the file waits and the header offers nothing; disabled during a run:
the other tools found, "Choose another app…", "Edit the text in the app" and the settings behind the caret; picking a
tool there makes it the preferred one), then "Keep Yours | Incoming | Both" for the whole file (`KeepChoices`, `conflictChoices`)
and Start over. Below, short one-line views: "Conflicts" with the count left, then "Changes" (the destination now → after
the merge), "Yours", "Incoming" and "Base". Conflicts read as labeled blocks instead of conflict markers
(`conflictHunkCss` over Pierre's view): a header naming the destination's side with Keep yours / Keep incoming / Keep both
for that conflict, its lines, the source's label and its lines. While a tool has the file, a banner says so (Bring to
front, Stop waiting), its conflicts show without choices and the merge can't complete; a toast tells how it ended.
Editing the text in the app opens a banner with Done and Discard edits; the choice shows picked and "Changes" shows what
it produces. Binary conflicts offer only the two versions to keep, as cards, and no merge tool. The
Incoming view resolves update conflicts with the same panel and run (in its update bar); server-branch merges keep one side for every file. A file
that merges automatically is never edited; its menu only overrides it by keeping one version. Once merged, the page
states where the result went.

Merges hold hundreds of conflicting files and thousands of changes. Every conflicting file's three versions load at
once (its status needs its automatic merge); each file merges once, when its versions are in (`loadConflict`), and
keeps its state while nothing about it changes (`buildStates`). The three-way merge (`diff3`) draws node-diff3's diff3
regions over Myers diffs of each side, whose time goes by the lines changed (lockfiles repeat lines by the thousand).
The list and Incoming render only the rows in view; the file behind the selection follows it deferred, so arrowing
never waits for a file to highlight. Conflicts, Base and the hand editor follow the diffs' size rule
(`syntaxHighlighting`), and Base (when big) and the hand editor render only the lines in view.

## Switching with pending changes

`cm switch` only ever runs on a clean workspace (`main/workspace/switchWithChanges.ts`), whatever client.conf's
`PendingChangesOnSwitchAction` says. The renderer's single entry point is `switchWorkspace`
(`app/shell/workspaceOperations.ts`): preflight, then ask (or follow the setting) whether to leave the changes or
bring them along. The main process shelves them with the official automatic-shelve comment, checks the shelve holds
them all, records it in the settings (`switchShelves`), undoes, moves added files aside (until the shelve brings them
back), switches, and merges the shelve on the target (bring). Failures put the changes back, switching back first if
the switch moved the workspace halfway. Left shelves (the app's and the official
client's) are offered again by the "Welcome back" banner in Changes (`features/leftChanges`), or restored
automatically on arrival when they apply cleanly. Changes still waiting to be brought (conflicts left for the merge
view) are offered on the target, and as left ones on the source if the user goes back instead.

## Shelves in Changes

Changes put aside, whoever put them there, are in one place: "N shelves" in the Changes header (`MyShelvesButton`,
⇧⌘S, "Your shelves…" in the palette), shown while the user has shelves in this repository from the last three months.

- **Shelving** (the check-in panel's Shelve mode) undoes what it shelves: `shelveAndUndo` (`main/workspace`) is the
  switch flow's first half. It shelves with the user's comment, checks the shelve holds every change (`createVerifiedShelve`),
  records it as a switch shelve record with `reason: 'shelve'`, undoes the changes and moves the files they added aside;
  a failure puts them back. The toast offers Undo (apply and delete). "Keep the changes here", under the comment, is the
  other way (a plain `cm shelveset create`), asked for each time: the panel goes back to checking in after a shelve.
- **The list** is one `cm find shelve` by owner and date (`useMyShelves`, `SLOW_CHANGING_QUERY`), refreshed by shelve
  operations; the count comes from it. Typing filters it, and after three letters one bounded server search by comment
  (`useShelvesSearch`, `shelvesScope`) finds older ones. A row opens the shelve's diff, which shows its comment and Apply as the page's
  primary action (`ShelveDiffActions`; only for a shelve a list already read). Apply is on the row; Apply and delete,
  code review, copy and delete are behind "More actions".
- **Everyone's** shelves are the other side of "Mine | Everyone" at the top (a radio group: Tab reaches it, ← → switch;
  ⇧⌘S again in the list; "Everyone's shelves…" in the palette). Every opening starts on Mine, which the button counts,
  and reads nothing more until Everyone is picked: then one `cm find shelve` by the same date alone
  (`useEveryonesShelves`; on codice@cloud 128 shelves in three months, 0.1 s, 60 KB), cached and refreshed like Mine's.
  `cm` can't sort shelves and `limit` keeps the oldest, so dates bound these queries, not limits: the list renders the
  newest 200 ("Newest 200 of N · filter to find others"), and the server search of everyone's goes back a year
  (limit 100 as a ceiling, "More may match" when reached). Rows name the author with their avatar ("You" for the
  user's own), and the filter matches authors in what is listed: `cm` matches owners only whole. Someone else's shelve
  is applied, shown, reviewed or copied, never deleted or restored from here (nor from its diff); the Shelves view
  keeps those. "All shelves" opens it with the same scope and filter.
- **Applying** (`shelves.apply`, `LeftChangesFinder.apply`) merges from `sh:N` at once when nothing conflicts, without
  leaving Changes; only conflicts open the merge view (whose `deleteShelve` finishes the same way). `cm` refuses to merge
  into a workspace with pending changes (unless client.conf's `MergeWithPendingChanges`), so the app offers to shelve
  them away first ("Set aside to apply shelve N"). A recorded shelve of this workspace gets its moved-aside files and
  changelists back; files are detached from the shelve's revisions (`detachReplacedFiles`), kept or deleted, so their
  diffs show the changes. The shelve stays unless deleted.
- **Left changes** (a switch or an update put them aside) are rows too, named "Left on /main/task", with Restore
  (apply, then delete) as in "Welcome back": the banner stays the prompt on the branch they were left on, and shelves
  shelved away (`reason: 'shelve'`) are never offered there nor restored on arrival.

## Windows

One window per workspace, so several tasks (often one AI agent each, in its own workspace and branch) run side by side.

- `main/window/WorkspaceWindows` opens the windows; opening a workspace that another window shows brings that window
  forward instead (`windows.focusWorkspace`, checked by `useOpenWorkspace`). A new window asked to open a workspace
  takes it at start (`system.takeRequestedWorkspace`), as does a folder the installed app is launched with on Windows
  and Linux (`workspaceArgument`; a second launch hands it to the running app). The Window menu lists them; closing
  the last one keeps the app on macOS, and the Dock icon opens the home screen; elsewhere it quits.
- Each API call runs with its window as the caller (`main/ipc/caller.ts`, followed across `await`s), so its commands
  (`commandLogged`) and operation progress go back to that window only. `workspaces.watch` is the window saying which
  workspace it shows: `main/watch/WorkspaceWatchers` keeps one watcher per shown workspace and sends its changes to the
  windows showing it; own writes are ignored in the workspace they touch.
- Settings are written in main, one change at a time; values computed from the stored ones (the recent workspaces) are
  computed there too, and every window gets the result (`settingsChanged`).
- What a window checks as it opens (`cm version`, `cm checkconnection`) runs until it succeeds once; later windows take
  that answer (`untilSucceeded`). A problem is checked again by the next window, and by Retry.
- "New workspace for a task" (`features/taskWorkspace`) creates a child of /main at its head (or takes an existing branch),
  a workspace next to the current one, and switches it (a plain `cm switch`: it's empty); a failure removes the new
  workspace and keeps the branch. The switcher shows the branch and pending changes of the other workspaces of the same
  repository with one local `cm status` each, only while it's open (`workspaces.glance`).

## Two developers on one branch

- `cm` rejects every checkin once the branch head moved ("A merge is needed from changeset…"), even without overlapping
  files. `checkinChanges` recognizes it (`checkinRejection`) and asks (`CheckinRejectedDialog`): when what came in touches
  none of the files and needs no merge, it updates (the guarded update) and checks in again with the same files and comment;
  otherwise it leads to Incoming, and Changes offers to check in once the workspace updated past the rejection.
- When the incoming check already knows the branch moved on (and names who checked in), the button reads "Update & check
  in" and takes the same path up front (`updateFirst`): no overlap updates and checks in without asking; overlap asks.
- An update stopped by colliding local changes (`--dontmerge`) shows a toast leading to Incoming (`explainUpdateConflicts`).
- Local changes to files the branch deleted or moved block the update. `shelveBlockedAndUpdate` shelves just those files
  as a switch shelve record (`reason: 'update'`), undoes them and updates; the "Welcome back" banner offers them back.

## Renderer

```
renderer/src/
  api/          API client, query keys, event hook
  app/          Shell: screens, navigation, command palette, settings, long-running operations
  components/   Domain-aware building blocks shared by features (status badges, path labels)
  features/     One folder per area (pendingChanges, branches, merge, ...)
  lib/          Pure helpers (selection, shortcuts, dates, actions)
  ui/           Design system primitives (buttons, dialogs, menus, tables, toasts)
  styles/       Design tokens and global CSS
```

- **Data**: TanStack Query. Every workspace query key starts with `queryKeys.inWorkspace(path, ...)`, so `invalidateWorkspace(path)` refreshes everything after an operation
  (or what it can touch: `invalidateWorkspace(path, affected)`, `runOperation({ affects })`).
- **Refresh**: views refresh themselves when something changes, never on a timer except the incoming check.
  - `main/watch/WorkspaceWatcher` watches an open workspace (recursive on macOS/Windows; on Linux a watch per folder,
    `FolderTreeWatch`, as Node's recursive mode there watches every file and loses files saved by replacing them;
    an event Windows sends without a name, when a burst overflowed its buffer, refreshes everything),
    skips `ignore.conf` folders and `.plastic` lock/temp files, coalesces bursts (300 ms quiet, 2 s max wait) and drops what the
    app's own writes cause (`changesWorkspace` commands and tracked operations): the renderer refreshes after those anyway.
    `cm status --changelists` writes the changelist files back on every read, so those rewrites count as its own too (`rewritesChangelists`).
  - `workspaceChanged` tells file edits (pending changes, review marks, files view, open diffs of workspace files; if auto refresh is on, and once when it's turned back on)
    from `.plastic` rewrites by any tool (workspace info; everything when the loaded changeset or branch moved). See
    `app/shell/useWorkspaceWatcher.ts` and `app/refresh/`. A diff with unsaved edits holds still and offers to reload instead.
    A hidden window (minimized, covered, on another desktop) keeps the changes and refreshes once, when it shows again.
    File edits name the folders they touched (up to `MAX_CHANGED_FOLDERS`, else anywhere): the files view re-reads only
    those listings and the ones above them (`isAffectedByFileChangesIn`), not every open folder.
  - Locks live on the server, where nothing reports changes: pending changes re-read them along with the changes, at most every 30 s.
  - Window focus (wired to real focus in `trackWindowFocus`) refetches stale server views; local views skip it while the watcher sees everything.
  - Incoming: `useIncomingSummary` polls every minute with focus, every five minutes behind other apps, never hidden, and on focus if
    older than 20 s. A branch head moved by someone else refreshes the repository views (`isAffectedByNewChangesets`).
  - Use `refreshQueries` for event-driven refreshes: it never cancels a fetch in flight, it queues one follow-up.
- **Review marks**: `main/review/ReviewStore` keeps, per workspace, the fingerprint of each file marked reviewed (and a copy of its text,
  read as the `reviewSnapshot` content source) under `<userData>/review-snapshots/`; marks of paths that leave the pending changes are dropped.
  Committed diffs (changeset, branch, shelve, range, code review) keep marks too, in `main/review/DiffReviewStore`: per repository,
  by the diff's name (`cs:42`, `br:/main/task`, `sh:3`) and the revision reviewed, so a branch's file is changed since its review once
  another revision shows; the least recently reviewed diffs are forgotten. `features/review` holds the shared list pieces.
  Marks only show in review mode, a per-workspace setting (`reviewModeWorkspaces`, off by default); leaving it keeps the marks.
- **Editing in the diff**: a workspace file shown against its own past (loaded revision, reviewed copy, or nothing for an
  added file: `canEditInPlace`) is typed into directly on its modified side, like the official client; every other diff
  (history, merges, conflicts) is read-only, with no caret. Pierre's editor holds the text and its undo (⌘Z while typing);
  `useFileBuffer` keeps what the disk doesn't have yet: Discard and Save (⌘S) show in the header as soon as there is some.
  Without unsaved edits the diff follows the disk; with some it holds still and says the file changed on disk. A file with
  no lines to show (no content changes, empty, only ignored differences) is typed into whole, under a note (kept while
  it's typed into). ⌘E puts the
  caret in the text and Esc leaves it for the file list; keys the editor handles never reach the app's shortcuts. Read and
  edit look the same: the editor is always on, so nothing in the diff moves when typing starts. Each pane of code
  scrolls sideways on its own and its bar would sit at the end of the file, so `PaneScrollbars` keeps one per pane at
  the bottom of the view (diffs, the whole-file editor, merge resolution). The whole-file editor renders only the lines
  in view (Pierre's `Virtualizer` on the diff's scrolling element). Shiki reads whole files at once, never just the
  lines in view, so `syntaxHighlighting` picks by size (both versions together), at 1.5 to 4 ms a KB on the main
  thread: an editable diff up to 400 KB highlights there (0.1 s for 2 x 16 KB, 0.57 s for 2 x 156 KB; highlighted once,
  with the editor's token transformer from the first render); a read-only diff only up to 20 KB (about 0.1 s), and up
  to 4 MB it renders only the lines in view, shows as plain text at once and takes its colors from Pierre's workers
  (`highlightWorkers`: 0.2 s for 2 x 16 KB, 1.2 s for 2 x 156 KB, 12 s for 2 x 1.6 MB); anything bigger, and an
  editable diff past 400 KB (Pierre
  highlights editors on the main thread, pool or not), is plain text and renders only the lines in view too (Pierre
  renders a plain text diff whole at every render: `pierrePlainTextRender` keeps it), with a quiet "Large file" in the
  header (its tooltip says why); such a diff is the "text" language (`highlightedLanguage`),
  or the editor would color the lines typed into it. Past 1 MB (both versions), the text typed into is diffed again
  once typing pauses, not at every keystroke (`diffsEveryKeystroke`): the +N −M and the lines discards act on follow
  then, as Pierre's recoloring does; nothing is discarded until they do.
  Every diff of two versions follows Split/Unified, one from or to an empty version (an empty base, a file emptied)
  too: `shownDiff` keeps both sides where Pierre would show a new or deleted file in one column, and the empty side is
  hatched like any added lines. An item with one version only (added, private, deleted; a revision that created the
  file) shows it alone, in one column. "No newline at end of file" shows only where the final line break is what changed (`noNewlineMarker`); a diff
  typed into keeps the marker rows, hidden, since Pierre recolors the rows it rendered only while there are as many as
  the diff has. The editor's line for the caret after the last line break (the one line of an empty text) looks like
  an unchanged empty line (`caretLineCss`): Pierre shows it as added after a change that removes more than it adds.
- **Leaving unsaved edits**: `app/navigation/leaveGuard` lets unsaved edits guard the way out. Selecting another file
  (`selectAfterLeaving`), another view (`goToView`) or checking in asks Save / Don't save / Cancel first; a diff that goes
  away without asking saves its edits, so work is never lost. Closing the window, quitting (⌘Q, whichever window has
  focus) or reloading asks the same (`guardUnloading`): the page holds its `beforeunload` back, the main process brings
  its window forward and sends `leaveRequested` (`main/window/leaveRequests`), and once the edits are saved or dropped
  `windows.continueLeaving` closes the window, quits or reloads; Cancel keeps the window and stops the quit.
- **Discarding changes**: a workspace file's diff against its loaded revision (or reviewed copy) discards changes from
  its gutter (`features/diff/viewer/useBlockDiscard`): hovering a changed line offers that one line (− removes an added
  line, ↶ restores a removed one) and a chip at the right end of the change's top edge (in the pane of its new code, clear
  of the line numbers and of the start of the line above) the whole change. Line numbers pick lines (click,
  Shift+click, drag, shown as they're picked; only changed lines' numbers react) and the chip then acts on them
  ("Restore 3 lines", ⌥⌘Z); picked lines show no line button of their own, and Esc or a click elsewhere drops the
  pick. Only lines the diff has as changed offer a button, as Pierre recolors lines a moment after typing stops and a
  hovered line may stop being one as the text changes under the pointer. After a discard the line that slides under
  the still pointer is hovered anew, so clicking on removes the lines
  below one by one (a click within 150 ms of the last is the rest of a double click). While typing, the chip stays
  hidden until typing pauses. The diff's focus ring is for the keyboard only (`usePointerFocusMark`: clicks mark what
  they focus, since Chromium shows `:focus-visible` once any key, even Shift, is pressed). The new text is computed in
  the renderer (`discardLines`). Without unsaved edits it's shown at once and written, and each file keeps an undo
  stack for the session (⌘Z in the diff); with some, it's one more edit in the editor, unsaved, and ⌘Z takes it back
  like typing.
- **Comparison method**: every text diff compares lines under the official client's methods (Ignore EOLs, Ignore
  whitespaces, both, Recognize all; one global preference, Recognize all by default). Lines are compared trimmed
  (`features/diff/viewer/comparisonMethod`) through a line comparator, so the diff still shows and discards the
  original text. One function computes the diff of two texts under a method (`lineDiff`, Pierre's `parseDiffFromFile`
  with the comparator as `parseDiffOptions`), and everything reads that one result: what the diff shows (`shownDiff`),
  the +N −M, whether the file is typed into whole ("Only whitespace differs"), and the blocks and lines discards act on.
  Every line diff (`diff`'s, Pierre's too) compares lines by id, each line's key read once, and runs Myers' algorithm
  only within a budget (`boundedLineDiff`, `boundedDiff`): past it, lines found once in each text anchor them (patience
  diff) and what's between is diffed on its own, so a rewritten or much-changed file takes linear time, not minutes.
  While the file is typed into, Pierre re-diffs it itself, with the same `parseDiffOptions`: `pierreLineComparison`
  patches the places Pierre 1.5.1 doesn't (its `FileDiff` never hands them to the renderer that re-diffs each
  keystroke, a keystroke's shortcut takes lines equal only when they're the same text, and text typed back to the
  original's shows no change), re-renders the diff whole when a keystroke leaves rows the diff doesn't have, and its
  test fails when a Pierre update moves them. `pierreTyping.test.ts` types into diffs of every kind of text (line
  breaks, final line breaks, whitespace, empty sides) under every method, checking after each keystroke that Pierre's
  diff is `lineDiff`'s and that the rows on screen are the diff's (`pierreSessionFixture`). `cm` commands keep their own
  comparison: merges don't change with it.
- **Line breaks**: lines end with LF, CRLF or the lone CR of classic Mac files (`lib/lineBreaks`). Pierre and `diff`
  break lines only at LF, so everything they get (diffs, the editors, conflicts, whole versions) shows each lone CR as
  a LF (`shownText`), with the same lines. Everything else keeps the files' own text: the editor's text goes back to
  the file's line breaks as it's typed (`diskText`: kept lines keep theirs, new ones take the file's most common),
  discards and merges split lines at all three, and one side of lone CRs against one of LFs still differs under the
  methods that recognize line endings (`crAgainstLf`); a file mixing both can't tell which of its LFs were CRs.
- **Images**: an image's bytes cross IPC as binary (`FileContent.image`, a `Uint8Array` and its type, 40 MB a side at
  most) and are painted from a blob URL that lives while it's shown (`useImageUrl`), never a data URL (35 MB of text for
  a 25 MB PNG, decoded again at every paint).
- **Images written as text**: an SVG reads as both (`toFileContent` ships its text and its image; past the text cap,
  only the image), so its diff shows rendered or as text, with a "Code | Image" switch in the header remembered per
  extension (`representations`, rendered by default). The text keeps every text feature (editing, discarding, the
  comparison method); the image every image mode, with unsaved edits rendered. SVG is only ever painted through `<img>`
  (no scripts, nothing fetched), and one declaring a huge size is drawn within 16 MP (`decodedSize`).
- **Mutations**: `runOperation` (progress card, cancel, refresh) for long operations; `runAction` for quick ones. Both report errors as toasts.
  An update or a switch runs alone on its workspace: it waits for any other operation, and the others wait for it (`blockingOperation`).
- **Navigation**: a view per sidebar entry (`app/navigation/viewRegistry.ts`) and a stack of drill-down pages (`app/navigation/pages.ts`) such as history, diff or merge.
- **Actions**: menus and the command palette share the `Action`/`MenuEntry` model (`lib/actions.ts`). Register palette commands (and their shortcuts) with `useCommands`.
- **Back buttons**: a page goes back with the mouse's back button and, on Windows, the Browser Back key (the `app-command`
  the main process forwards as `navigateBack`), once per press however it arrives (`useBackButtons`).
- **Keyboard**: every shortcut is declared in `lib/shortcutRegistry.ts` and bound through `hotkey(id)`; the shortcuts sheet
  (`?`, ⌘/) lists the registry, and a test rejects shortcut literals anywhere else and menu accelerators that differ. Views
  get ⌘1… in sidebar order (`viewShortcut`; past the ninth ⌥⌘1… on macOS, whose ⇧⌘3–5 take screenshots). Window
  shortcuts and menu commands run once per press and wait while a modal dialog is open (`lib/modalDialog`).
  `mod` is ⌘ on macOS and Ctrl elsewhere, shown as symbols in the Mac's order (⇧⌘K) or spelled out (Ctrl+Shift+K,
  `formatShortcut`). A shortcut takes other keys off macOS where Windows and Linux conventions differ (`keysOffMac`: Alt+←
  back, Delete deletes) and never Ctrl+Alt there, which is AltGr on European layouts (the test checks it). Letters match
  by the character typed (Ctrl+Z on a German keyboard), digits by position. F2 renames the selected file, branch, label or
  attribute (`useRenameCommand`); the context-menu key and Shift+F10 open a list's menu at its focused row. A field keeps
  its own text chords, Ctrl+Y (redo) included off macOS (`belongsToField`).
- **Per OS**: platform differences go through small pure helpers taking the platform (`revealLabel`, `trashName`,
  `windowChrome`, `appMenuTemplate`, `formatShortcut`), read once in `lib/platform.ts`. Windows draw their title bar per
  `windowChrome`: macOS insets its traffic lights over the sidebar's top band; Windows hides its title bar and overlays
  its caption buttons on the top bar (`titleBarOverlay`, clear, symbols in the theme's text color; the page keeps
  `--caption-buttons-width` free), with a menu button in the band (and Alt or F10) popping up the menu bar's menus;
  Linux keeps the desktop's frame and menu bar. Native parts follow the app's theme (`followAppTheme`). The menus
  (`main/window/appMenuTemplate`) have an app menu on macOS only; elsewhere File ends with Settings and Exit (Windows)
  or Quit (Linux), Help with About, and `&` marks each item's Alt letter.
- **Focus**: the list, tree or graph a view or page works on carries `MAIN_FOCUS` (`lib/mainFocus.ts`). `useMainFocus`
  focuses it after navigating and whenever focus falls to the document (a dialog, menu or popover closed), and hands it
  list keys pressed while nothing has focus. Views keep their list's selection while away (`useViewSelection`). Lists
  expose ARIA roles (grid, tree, listbox) with `aria-activedescendant` on the focused container.
- **Dialogs**: `openDialog`/`askDialog`, `confirm`, `prompt` — callable from anywhere, no local state plumbing.
- **List and details**: `ListWithDetails` (each view remembers its own details width, `widthKey`; a file tree keeps its own width instead, `sized="list"`) around a `DetailsPanel`. Every
  kind reads the same way: the kind and status badges with the default action (what Enter does on the row) and the row's
  context menu behind "More actions"; a `DetailsHeading` (the comment's first line as the title and the rest as its
  description, or the object's name with the comment below; edited in place where cm can edit it); a meta row (author ·
  date · spec to copy · branch chip); attribute chips (`AttributeChips`); properties and relations behind "More details";
  then the changes pane under a remembered splitter (`DetailsChangesPane`). cm edits changeset, attribute and label
  comments (a label's by applying it again to its changeset, `labelCommentArgs`); branch and shelve comments stay
  read-only: no `cm` command or client API edits them. Selecting a row must stay cheap: `cm diff`
  runs only on request (`ChangedFilesSection`), other lookups wait for the selection to settle (`useSettled`), and
  immutable results are cached (`IMMUTABLE_QUERY`).
- **Item rows**: every list of files and folders reads the same (`components/`): `ItemRow` lays out the icon, the name
  (cut first), extras (lock chips, review marks, +N −M) and, last on the row, `ItemStatusMark`: the status letter of
  Changes (`StatusBadge`) for what is notable only (a pending change, a checkout), or a dot for a folder with changes
  inside; nothing marks an item up to date. Private items dim, ignored ones further, deleted ones are struck through.
  `ItemIcon` is Lucide's (ISC, tree-shaken, already the app's icon set): a solid slate folder, or a filled neutral page
  with the file's family as its glyph (`fileKind`: code, data, text, image, media, archive, Unity asset, binary; Unity's
  `.meta` files dim), in the `--icon-*` tokens; color is left to statuses. Native icons (`app.getFileIcon`) were
  rejected: macOS answers a generic page for a path not on disk (repository trees, deleted files), they're bitmaps
  that ignore the app's theme, and every OS draws them differently.
- **Files**: the tree keeps its width (400 px at first; on a narrow window it gives way first, keeping 480 px for the
  diff: `FILE_TREE_WIDTH`) and shows names only, with Modified once it's wider than 420 px: size, changeset, author
  and comment are the selected item's, above its diff. A file shows one diff, the most telling for its status
  (`itemComparison`), its toolbar saying what it compares: a pending change against the loaded revision as in Changes
  ("Your changes · vs cs:12": editable, discards), an up-to-date file's last change against its parent revision (the
  listing names it, as History's `parentRevision` finds first: "Last change · cs:12 on /main by Ana · 2 days ago ·
  comment"), a file with no revision whole against nothing ("New file", "Private file"). "Annotate" beside it
  toggles the file annotated (kept as the selection moves), its revision by id in its repository (`itemRevision`), or
  as on disk while it has changes. A folder shows what it holds and its last change. The diff and `cm` lookups wait for
  the selection to settle (`useSettledValue`, without remounting); revisions are cached immutable. F6 moves the keys
  into the diff to scroll it, F6 or Esc back to the tree, which keeps `MAIN_FOCUS`. Browse repository shows its tree
  the same way, every item as its revision.
- **Files: moving items**: ⌘X (Ctrl+X) cuts the selected items (`cutItemsStore`: only the outermost, never the root),
  ghosted with a hint in the header; cutting again replaces them, and they stay cut across views until pasted, Esc
  (never one a menu, dialog or field took) or another workspace. ⌘V moves them into the selected folder or the
  selected file's (`pastePlan`, pure): never into themselves, a private folder (controlled items) or onto a name the
  folder has in any case (those stay, after asking); items already there are left. `explorer.moveItems` runs it as one
  operation, a `cm move` per controlled item and a rename on disk per private one, refusing any existing target
  (`cm move` onto a folder moves inside it); then the moved items are selected, with Undo.
- **Branch switcher**: groups and orders branches like the official Desktop client (`branchSwitcherGroups`): /main by its
  well-known GUID, the workspace's recent branches, then the rest newest first. Recent branches are the official client's,
  read from and written to its `plasticgui.conf` (`main/plasticConfig`) on every switch, so both apps list the same ones.
- **Styling**: CSS modules using the tokens in `styles/tokens.css`. No raw colors in components.
  - Text tokens keep 4.5:1 and focus rings 3:1 (`styles/tokens.test.ts`); focus shows with `--focus-ring-visible`, or
    `--focus-ring-inset` on rows and panes (over their content when it would paint over the ring); filled controls
    draw `--focus-outline` 2px out, and state rules with a shadow of their own restore the ring (`focusRings.test.ts`).
  - Motion uses the `--duration-*` and `--ease-*` tokens and the shared keyframes of `styles/global.css` (through
    `--keyframes-*`); reduced motion zeroes the durations, so only loops (spinners, skeleton pulses) opt out themselves.
  - Lists that load show skeletons at their real row height (`ui/Skeleton`, `TableSkeleton`, `ListWithDetailsSkeleton`).

## Server budget

Repositories like `codice@codice@cloud` hold ~280k changesets, ~20k branches, thousands of labels, shelves and reviews,
and many people use the same server. Every `cm` command other than local reads (`status`, `getworkspacefrompath`,
`workspace list`, `profile list`, `version`...) is server work, so each one has to earn its place:

- **Idle** (focused, nothing touched): only the incoming check, one `cm find changeset ... --format={changesetid}{owner}` a
  minute (every five behind other apps, none while hidden). It takes the branch and loaded changeset from the workspace
  info, which follows `.plastic`, instead of asking `cm status`. Nothing else polls: left changes, locks and lists wait
  for an event, a focus or an operation.
- **Focus**: the incoming check if older than 20 s, and the server views on screen once stale (30 s by default). Lists
  that hardly change by themselves and are heavy to read use `SLOW_CHANGING_QUERY` (every branch, every label, attribute
  types, attribute values, the working object's comment, the palette's lists, the recent shelves in Changes, the user's and everyone's): five minutes, and focus never re-reads them. The Branch
  Explorer is kept five minutes and focus never re-reads all history. Local views skip focus while the watcher sees the disk.
- **Home**: the repository and branch of every listed workspace come from its `.plastic/plastic.selector` file
  (`workspaces.heads`); `cm` is asked only about recent workspaces whose file can't tell.
- **Selection**: arrowing through rows costs nothing; details ask once the selection settles (`useSettled`; `useSettledValue` for details that stay on screen as the selection moves, like a history's diff or any file's diff, `useDiffContents`, which shows a pair read before at once), `cm diff`
  runs only on request, and immutable results (what a changeset, shelve or branch head changed, revisions by id, specs
  pinned to a changeset or shelve, annotations of pinned revisions) are cached (`IMMUTABLE_QUERY`; the last 100 off screen, `boundUnusedQueries`) and skipped by refreshes.
  An object opened from a list already read starts from it (`useChangeset`) and is asked for only once that list is stale.
- **After an operation**: `invalidateWorkspace` refetches what is on screen and marks the rest stale, scoped to what the
  operation can change (`refreshScopes.ts`, `runOperation({ affects })`, `runAction(..., affects)`): a checkin, an update
  or a merge from a branch leave labels, shelves, attributes, reviews, left changes and changesets already read alone;
  shelving changes that stay in the workspace refreshes only the shelve lists, and shelving them away those and the workspace; a new, deleted or hidden branch only the
  branch lists and the Branch Explorer; a label edit the labels and the graph; an attribute or value edit only the
  attributes. Reads refresh nothing (`runRead`: the switch preflight, previews, opening a file); two operations in a row refresh once, after
  the last (create a branch and switch to it). Views keyed by the workspace info (`keyedByWorkspaceInfo`: left changes, the
  incoming check, the branch the workspace is on) wait for it, and when the operation gave them another key they are only
  marked stale: they are read under the new key as they show, never once more under the old one. Event-driven refreshes
  are scoped too: someone else's checkin leaves labels, shelves, attributes, reviews and the workspace's own annotations alone.
- **Reuse**: what a command already returned answers later questions instead of another command. Code reviews name
  their branch by object id: the branch chips (Branch Explorer, Branches, finishing a task) match it against the ids
  their branch lists already carry, and share one review list with the palette; the Code reviews view and page name it
  from the branch lists already read (`BranchNamesCache.remember`), or else read every branch's id and name once
  (`readBranchNames`, two light queries, kept ten minutes). The top bar takes the branch comment from the branch query. Pending changes ask which locks are mine only when some lock holds one of them; left
  changes look the selector's object id up only when an automatic shelve by another client could match it, and arriving
  from a switch looks for changes to restore only when this app left some there.
- **Queries**: list everything only when the view needs everything, and then read it rarely. Otherwise filter on the
  server: a date (`sinceDate`), a `limit`, one object by name or id (`api.branches.get`). Never OR ids together
  (`where id = 1 or id = 2 …`, checked by `noOredIdLookups.test.ts`): take names and details from the query that lists
  the objects (`--format` fields, `{id}` in branch lists), or from one bounded query the view needs anyway. Prefer
  `--format` with just the fields needed over `--xml`.
  Equivalent filters must share one query key (`compactFilter`). A parse failure must fail, never degrade to an empty
  filter (`parseWorkspaceStatus`): `cm find changeset where changesetid > -1` reads the whole repository.
- **Guard**: development builds warn in the console (`[server budget]`) when the same server command runs more than
  twice in ten seconds (`main/cm/repeatedCommands.ts`).

## Conventions

- Names reveal intent; small files; one component or concept per file.
- No dead code, no speculative abstractions, no duplicated logic.
- Pure logic gets a `*.test.ts` next to it (`npm test`).
- `npm run typecheck` must pass.
- To see the app, either:
  - scripted: `npm run build && node scripts/screenshot.mjs /tmp/shot.png open:<workspace path> key:Meta+3`, or
  - interactive: `npm run build && UVCS_CDP_PORT=9333 npm run app:debug &`, then
    `npx playwright-cli attach --cdp=http://localhost:9333` and use `snapshot`, `click <ref>`, `screenshot`
    (see `.claude/skills/playwright-cli`). Use a distinct port and `-s=<session>` per parallel agent.
- `UVCS_RENDERER_PLATFORM=win32` (or `linux`) in the environment previews another OS's shortcuts, copy and layout from a
  Mac (the page only: the menus and window frame stay the Mac's).
