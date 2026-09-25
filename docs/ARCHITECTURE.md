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
   - `query()` for short reads: reuses pooled `cm shell` sessions (much faster than spawning `cm`).
   - `execute()` for long or cancellable work (update, switch, checkin, merge): a dedicated process that streams progress lines.
5. Every command is logged and pushed to the window whose call ran it (`commandLogged`), shown in the command log panel.

## Parsing `cm` output

- Prefer `--xml` (`parseXml`) or `--format` with `recordFormat`/`parseRecords` (control-character separators; no ambiguity with paths or comments).
- Never parse human-readable output when a machine format exists.
- Multi-line text (comments) goes through temp files (`-commentsfile`); `cm shell` cannot take quotes or newlines in arguments.
- A `cm shell` command ends at the `CommandResult <code>` line that ends its output, with nothing more in the pipe
  (`CmShellSession`): comments can quote such lines, and a misread end shifts every later command by one output.

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
  `runCmProcess` splits lines at `\r` too. The words are localized: readers go by the line's shape.
- `cm checkin --machinereadable` reports uploaded bytes only every 5 s with redirected output; `cm merge` prints its plan,
  then a record per change applied in a burst, then downloads silently; `cm shelveset create` only names its stages.
- Stopping is offered only while it leaves things as they were: a killed update or switch leaves the workspace half
  updated with partial files as private `.private.0` copies, and a checkin killed while confirming may be half recorded;
  killed while uploading, nothing is committed.
- The renderer keeps each operation's progress and its bar motion (`runningOperationsStore`, `progressBar`): the bar
  glides linearly towards where the next report should land at the current pace (never backwards, at most halfway into
  what's left), sweeps while nothing is measured, and stays full and shimmering while wrapping up. `OperationCard` draws
  it in fixed rows and widths, then turns into the success message in place; the status bar, the branch pill and the
  incoming chip show the same operation with a `ProgressRing`.

## No external tools, ever

The app never lets `cm` open its merge or diff tool; every conflict is resolved in the app's merge page.

- `cm merge --merge` always carries `--nointeractiveresolution` and an explicit decision for every conflicting file
  (`fileConflictArgs`): workspace merges keep the destination and the app writes the resolutions; merges into a
  server branch keep one side for all files.
- Shelves are applied as merges from `sh:N` (never `cm shelveset apply`); `cm update` keeps `--dontmerge`;
  `cm diff` always has `--format`. `main/cm/noExternalUi.test.ts` checks these statically.
- `cm` processes run with stdin closed, so a console prompt fails instead of hanging.

## Merge page

The merge page (`features/merge`) is a preview until "Complete merge": it says so ("Preview", "Nothing has changed yet"),
and every status reads as what the merge will do, never as done (`mergeStatus`): "Will merge automatically", "Needs your
decision", then the user's choice ("Keeping yours", "Keeping incoming", "Combined", "Edited by you"), one chip in the list
and the file header, explained by its tooltip. Sides are "Yours"/"Incoming" in a workspace and "Destination"/"Source" when
merging into a server branch (`mergeLabels`), always next to their branch. A conflicting file is read-only, with short
one-line views: "Conflicts" while any is left (each with Keep yours / Keep incoming / Keep both), then "Changes" (the
destination now → after the merge), "Yours", "Incoming" and "Base". A file with conflicts offers whole-file choices
(`conflictChoices`): Keep yours, Keep incoming, Keep both, or "Resolve by hand…", the only way to edit text, under a
banner with Done and Discard edits; the choice shows picked and "Changes" shows what it produces. A file that merges
automatically is never edited; its menu only overrides it by keeping one version. Once merged, the page states where
the result went.

## Switching with pending changes

`cm switch` only ever runs on a clean workspace (`main/workspace/switchWithChanges.ts`), whatever client.conf's
`PendingChangesOnSwitchAction` says. The renderer's single entry point is `switchWorkspace`
(`app/shell/workspaceOperations.ts`): preflight, then ask (or follow the setting) whether to leave the changes or
bring them along. The main process shelves them with the official automatic-shelve comment, checks the shelve holds
them all, records it in the settings (`switchShelves`), undoes, moves added files aside (leave), switches, and
merges the shelve on the target (bring). Failures put the changes back. Left shelves (the app's and the official
client's) are offered again by the "Welcome back" banner in Changes (`features/leftChanges`), or restored
automatically on arrival when they apply cleanly.

## Windows

One window per workspace, so several tasks (often one AI agent each, in its own workspace and branch) run side by side.

- `main/window/WorkspaceWindows` opens the windows; opening a workspace that another window shows brings that window
  forward instead (`windows.focusWorkspace`, checked by `useOpenWorkspace`). A new window asked to open a workspace
  takes it at start (`system.takeRequestedWorkspace`). The Window menu lists them; closing the last one keeps the app on
  macOS, and the Dock icon opens the home screen.
- Each API call runs with its window as the caller (`main/ipc/caller.ts`, followed across `await`s), so its commands
  (`commandLogged`) and operation progress go back to that window only. `workspaces.watch` is the window saying which
  workspace it shows: `main/watch/WorkspaceWatchers` keeps one watcher per shown workspace and sends its changes to the
  windows showing it; own writes are ignored in the workspace they touch.
- Settings are written in main, one change at a time; values computed from the stored ones (the recent workspaces) are
  computed there too, and every window gets the result (`settingsChanged`).
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

- **Data**: TanStack Query. Every workspace query key starts with `queryKeys.inWorkspace(path, ...)`, so `invalidateWorkspace(path)` refreshes everything after an operation.
- **Refresh**: views refresh themselves when something changes, never on a timer except the incoming check.
  - `main/watch/WorkspaceWatcher` watches an open workspace (recursive on macOS/Windows; the root and `.plastic` only on Linux),
    skips `ignore.conf` folders and `.plastic` lock/temp files, coalesces bursts (300 ms quiet, 2 s max wait) and drops what the
    app's own writes cause (`changesWorkspace` commands and tracked operations): the renderer refreshes after those anyway.
  - `workspaceChanged` tells file edits (pending changes, review marks, files view, open diffs of workspace files; if auto refresh is on, and once when it's turned back on)
    from `.plastic` rewrites by any tool (workspace info; everything when the loaded changeset or branch moved). See
    `app/shell/useWorkspaceWatcher.ts` and `app/refresh/`. A diff being edited holds still and offers to reload instead.
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
- **Discarding changes**: a workspace file's diff against its loaded revision (or reviewed copy) discards a whole change
  from a chip in the gutter, or just the lines picked by their numbers (`features/diff/viewer/useBlockDiscard`). The new
  text is computed in the renderer (`discardLines`), shown at once and written; each file keeps an undo stack for the session.
- **Comparison method**: every text diff compares lines under the official client's methods (Ignore EOLs, Ignore
  whitespaces, both, Recognize all; one global preference, Recognize all by default). Lines are compared trimmed
  (`features/diff/viewer/comparisonMethod`) through a line comparator handed to Pierre and `diff`, so the diff still
  shows and discards the original text. `cm` commands keep their own comparison: merges don't change with it.
- **Mutations**: `runOperation` (progress card, cancel, refresh) for long operations; `runAction` for quick ones. Both report errors as toasts.
- **Navigation**: a view per sidebar entry (`app/navigation/viewRegistry.ts`) and a stack of drill-down pages (`app/navigation/pages.ts`) such as history, diff or merge.
- **Actions**: menus and the command palette share the `Action`/`MenuEntry` model (`lib/actions.ts`). Register palette commands (and their shortcuts) with `useCommands`.
- **Keyboard**: every shortcut is declared in `lib/shortcutRegistry.ts` and bound through `hotkey(id)`; the shortcuts sheet
  (`?`, ⌘/) lists the registry, and a test rejects shortcut literals anywhere else and menu accelerators that differ. Views
  get ⌘1… in sidebar order (`viewShortcut`).
- **Focus**: the list, tree or graph a view or page works on carries `MAIN_FOCUS` (`lib/mainFocus.ts`). `useMainFocus`
  focuses it after navigating and whenever focus falls to the document (a dialog, menu or popover closed), and hands it
  list keys pressed while nothing has focus. Views keep their list's selection while away (`useViewSelection`). Lists
  expose ARIA roles (grid, tree, listbox) with `aria-activedescendant` on the focused container.
- **Dialogs**: `openDialog`/`askDialog`, `confirm`, `prompt` — callable from anywhere, no local state plumbing.
- **List and details**: `ListWithDetails` (one remembered details width for every view) around a `DetailsPanel`. Every
  kind reads the same way: the kind and status badges with the default action (what Enter does on the row) and the row's
  context menu behind "More actions"; a `DetailsHeading` (the comment's first line as the title and the rest as its
  description, or the object's name with the comment below; edited in place where cm can edit it); a meta row (author ·
  date · spec to copy · branch chip); attribute chips (`AttributeChips`); properties and relations behind "More details";
  then the changes pane under a remembered splitter (`DetailsChangesPane`). cm edits changeset, attribute and label
  comments (a label's by applying it again to its changeset, `labelCommentArgs`); branch and shelve comments stay
  read-only: no `cm` command or client API edits them. Selecting a row must stay cheap: `cm diff`
  runs only on request (`ChangedFilesSection`), other lookups wait for the selection to settle (`useSettled`), and
  immutable results are cached (`IMMUTABLE_QUERY`).
- **Branch switcher**: groups and orders branches like the official Desktop client (`branchSwitcherGroups`): /main by its
  well-known GUID, the workspace's recent branches, then the rest newest first. Recent branches are the official client's,
  read from and written to its `plasticgui.conf` (`main/plasticConfig`) on every switch, so both apps list the same ones.
- **Styling**: CSS modules using the tokens in `styles/tokens.css`. No raw colors in components.
  - Text tokens keep 4.5:1 and focus rings 3:1 (`styles/tokens.test.ts`); focus shows with `--focus-ring-visible`, or
    `--focus-ring-inset` on rows and panes (over their content when it would paint over the ring).
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
  types, the working object's comment, the palette's lists): five minutes, and focus never re-reads them. The Branch
  Explorer is kept five minutes and focus never re-reads all history. Local views skip focus while the watcher sees the disk.
- **Home**: the repository and branch of every listed workspace come from its `.plastic/plastic.selector` file
  (`workspaces.heads`); `cm` is asked only about recent workspaces whose file can't tell.
- **Selection**: arrowing through rows costs nothing; details ask once the selection settles (`useSettled`), `cm diff`
  runs only on request, and immutable results (what a changeset, shelve or branch head changed, revisions by id) are
  cached (`IMMUTABLE_QUERY`) and skipped by refreshes.
- **After an operation**: `invalidateWorkspace` refetches what is on screen and marks the rest stale. Event-driven
  refreshes are scoped (`refreshScopes.ts`): someone else's checkin leaves labels, shelves, attribute types and reviews alone.
- **Queries**: list everything only when the view needs everything, and then read it rarely. Otherwise filter on the
  server: a date (`sinceDate`), a `limit`, one object by name or id (`api.branches.get`), batched id lookups
  (`branchNamesById`, remembered by `BranchNamesCache`). Prefer `--format` with just the fields needed over `--xml`.
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
