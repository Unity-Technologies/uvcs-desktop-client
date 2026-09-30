# Architecture

A desktop client for Unity Version Control. The only backend is the `cm` CLI.

```
src/
  shared/     Types shared by both processes: domain model, API contract, events. No runtime deps (a test checks it).
  main/       Electron main process. Talks to `cm`, the file system and the OS.
  preload/    Exposes `window.uvcs` (invoke + events) to the renderer. Nothing else.
  renderer/   React UI.
```

This file holds what every change must respect. Each feature area's own rules live in `docs/features/`; read the one
you touch:

| Doc                                     | Covers                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `features/diff.md`                      | Editing, discarding, stepping through changes, comparison methods, line breaks, images, review marks, highlighting memory |
| `features/merge.md`                     | The merge page, conflict resolution, external merge tools                      |
| `features/shelves-and-switching.md`     | Switching with changes, a workspace on a shelve, shelves in Changes, two people on one branch |
| `features/files-history-annotate.md`    | Files, Browse repository, Go to file, cut and paste, history, annotate         |
| `features/branch-explorer.md`           | The graph's canvas, keeping the place, the pending changeset, the branch switcher |

## How a request flows

1. A component calls `api.<area>.<method>(...)` (`renderer/src/api/client.ts`), a typed proxy of `UvcsApi` (`shared/api`).
2. The preload forwards it over one IPC channel; `main/ipc/registerApi.ts` dispatches to the service.
3. Services (`main/services/<area>Service.ts`) build `cm` arguments and parse the output with helpers in `main/cm/`.
4. `CmClient` runs the command, routed by duration and cancellability, never by read vs write. Starting a `cm`
   process costs 100–150 ms before the command runs (macOS; more on Windows), while a warm `cm shell` answers a quick
   command in a few ms:
   - `query()` for quick commands, reads and small writes alike (a label, a rename, an undo of a few files): reuses
     pooled `cm shell` sessions, two per working directory; a command takes the first one free, and a directory idle
     for ten minutes lets its sessions go; a workspace no window shows anymore lets them go once their commands are
     done (`WorkspaceWatchers` `onStopped`). A session takes about a second to answer its first command, so until one
     in that directory has, the query runs as a process of its own. A workspace write that may run long (`runsLong`:
     more than `MAX_QUICK_WRITE_PATHS` paths, recursive, or a transfer) runs as a process of its own too, so it never
     holds a session every read of the workspace would wait behind.
   - `execute()` for long or cancellable work (update, switch, checkin, shelve, merge, sync; the Branch Explorer's
     merges `find`, the slowest query on big repositories): a dedicated process that streams progress lines.
   - A command line too long to start a process with (a checkin or shelve of thousands of paths: Windows takes 32,767
     characters, quotes included) is written to a `cm shell` of its own instead (`processCommand`): still one command, never split.
     So is, on Windows, a command that prints text (see Parsing).
   - A pooled command may take two minutes, a workspace write half an hour (a few paths can still be a whole tree).
5. Every command is logged and pushed to the window whose call ran it (`commandLogged`), for the command log panel
   (see Renderer: Command log); one that ended without an exit code (stopped on a prompt, `cm` not found) is logged
   with -1, and one its caller cancelled is not logged: it's no failure.

To add a capability: its types in `shared/domain`, the method in `shared/api/<area>.ts` (part of `UvcsApi`), the
implementation in `main/services/<area>Service.ts` (wired in `createServices`), `cm` argument builders and parsers as
pure, tested helpers in `main/cm/`, then a query or mutation in the renderer through `api.<area>.<method>`. The preload
and the IPC channel never change.

## Server budget

Repositories like `codice@codice@cloud` hold ~280k changesets, ~20k branches, thousands of labels, shelves and reviews,
and many people use the same server. Every `cm` command other than local reads (`status`, `getworkspacefrompath`,
`workspace list`, `profile list`, `version`...) is server work, so each one has to earn its place:

- **One command for N things**: never run a command per row, file, branch or id in a loop. Read everything a view
  needs in one command that returns N records (one `cm find` per list, one `cm ls` of every conflicting file:
  `withConflictRepositories`), and a second command only for the few items the first couldn't answer
  (`repositoryPath`). Reads go through `CmClient.query()`, so they reuse a warm `cm shell` instead of starting a
  process; `execute()` is only for long, streamed or cancellable work.

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
  attributes; a code review created, edited, marked reviewed or deleted only the reviews (their lists and the branch chips); releasing a lock only the locks; deleting a shelve or discarding left changes only the shelve lists and the left changes, and applying or restoring one those, the workspace and its locks; adding, checking out, removing or undoing files only the workspace and its locks; a changeset's comment edited only what shows changesets, and one moved or deleted those, the branch lists and incoming. Reads refresh nothing (`runRead`: the switch preflight, previews, opening a file); two operations in a row refresh once, after
  the last (create a branch and switch to it: `createBranchAndSwitch`). Views keyed by the workspace info (`keyedByWorkspaceInfo`: left changes, the
  incoming check, the branch the workspace is on) wait for it, and when the operation gave them another key they are only
  marked stale: they are read under the new key as they show, never once more under the old one. Event-driven refreshes
  are scoped too: someone else's checkin leaves labels, shelves, attributes, reviews and the workspace's own annotations alone.
- **Reuse**: what a command already returned answers later questions instead of another command. Code reviews name
  their branch by object id: the branch chips (Branch Explorer, Branches, finishing a task) match it against the ids
  their branch lists already carry, and share one review list with the palette; the Code reviews view and page name it
  from the branch lists already read (`BranchNamesCache.remember`), or else read every branch's id and name once
  (`readBranchNames`, two light queries, kept ten minutes). The top bar takes the branch comment from the branch query. The recent branches and renaming a workspace take its
  GUID and name from the reads the workspace info shares (`WorkspaceHeaders`). Pending changes ask which locks are mine only when some lock holds one of them; left
  changes look the selector's object id up only when an automatic shelve by another client could match it, and arriving
  from a switch looks for changes to restore only when this app left some there.
- **Queries**: list everything only when the view needs everything, and then read it rarely. Otherwise filter on the
  server: a date (`sinceDate`), a `limit`, the people picked (`owners`), one object by name or id (`api.branches.get`). Never OR ids together
  (`where id = 1 or id = 2 …`, checked by `noOredIdLookups.test.ts`): take names and details from the query that lists
  the objects (`--format` fields, `{id}` in branch lists), or from one bounded query the view needs anyway. Prefer
  `--format` with just the fields needed over `--xml`.
  Equivalent filters must share one query key (`compactFilter`). A parse failure must fail, never degrade to an empty
  filter (`parseWorkspaceStatus`): `cm find changeset where changesetid > -1` reads the whole repository.
- **Guard**: development builds warn in the console (`[server budget]`) when the same server command runs more than
  twice in ten seconds (`main/cm/repeatedCommands.ts`).

## Parsing `cm` output

- Prefer `--xml` (`parseXml`) or `--format` with `recordFormat`/`parseRecords` (control-character separators; no ambiguity with paths or comments).
- Never parse human-readable output when a machine format exists.
- `cm find branch` leaves hidden branches out unless asked for (`hidden = 'true'`), and `cm find changeset` their
  changesets unless `ignorehidden = 'true'` (`branchExplorerFinds`); merges and labels come either way.
- Multi-line text (comments) goes through temp files (`-commentsfile`); `cm shell` cannot take quotes or newlines in arguments.
- A `cm shell` command ends at the `CommandResult <code>` line that ends its output, with nothing more in the pipe
  (`CmShellSession`, `resultLineAtEnd`): comments can quote such lines, and a misread end shifts every later command by
  one output.
- Text crosses as UTF-8 on every OS: `cm shell --encoding=utf-8` reads commands so (Windows would read them in the
  console's code page), and `find` and `--xml` output is asked for in UTF-8 (`withUtf8Output`). Other output of a
  process comes in the console's code page on Windows (437, 850: other scripts become `?`), while a `cm shell` prints
  it in UTF-8, so there a process that prints text (diffs, merges, updates, logs) runs as a `cm shell` of its own
  (`processCommand`, `printsInConsoleCodePage`); only error messages stay in the code page. Windows' CRLF becomes LF before any parser sees the output, and relative paths
  in `cm status --xml` get forward slashes.
- On macOS `cm` reads names decomposed (NFD), as it reports them: local paths go to it so (`inCmPathForm`), or
  `cm checkin` of a composed `é.txt` finds no change. Branch names, queries and server paths are left as written.
- `cm checkin` first undoes the checkouts whose content is the loaded revision's; with nothing left it prints
  `NO_CHANGES_APPLIED` instead of `CHANGESET cs:N@…` and exits 0 (`readCheckinOutput`). When every change checked in was
  a checkout without edits (`isUnchangedCheckout`: `CO`, not `CO+CH`, in `cm status --iscochanged`), Changes says so in
  an info toast ("Nothing to check in"); with any other change in, no changeset is a failure (`expectedCheckinResult`).

## Xlinks

Revision ids, item ids and changeset numbers are per repository, and an item under an xlink (nested ones too, and on
other servers) lives in the xlinked repository: `cm` looks a bare `revid:432251` up in the workspace's, where it is
another file or none. So a revision is never a bare id: `RevisionRef` (`shared/domain/revision.ts`) is an id with its
repository, set where `cm` names it, and every spec built from it names both (`spec.revision`: `revid:N@repo@server`,
`spec.itemAt`: `itemid:N#cs:M@repo`), as the official client carries each diff item's mount repository.

- Each item records its repository as parsed: `cm diff --format={repository}` (`DiffEntry`, so every committed diff,
  Incoming and update conflicts), `cm ls` `<Repository>` (`TreeItem`: Files, Browse repository), `cm history`'s
  records (`ItemRevision`). Content sources (`{ kind: 'revision', revision }`), open/save revision and query keys carry
  it, so two repositories' revision 45 never share a cached content.
- No repository path reaches through an xlink (`serverpath:/lib/a.cs#cs:12` finds nothing when `lib` is one), but
  workspace paths and `cm ls --tree` do. A history opened from a diff or a repository tree reads the item of its
  revision (`rev:revid:N@repo`, `itemHistoryTarget`); a merge change's version under an xlink is looked up in the
  changeset's tree once `serverpath:` finds nothing (`repositoryPath`, a second command only for those).
- `cm merge` prints conflicting files under a writable xlink with the xlinked repository's item id and changesets but
  not the repository: one `cm ls` of the conflicting files in the destination's tree names each one's
  (`withConflictRepositories`), only when some file conflicts.
- An item of another repository than the workspace's (`otherRepository`) keeps its changeset, branch and comment (read
  `on repository`), but leads to none of the workspace's views: no changeset diff, Branch Explorer, branch chip link or
  labels, and its changeset spec is copied with its repository.

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

## Secrets

Every command is logged, sent to the window's command log and quoted in its `CmError`, so a secret passed to `cm` is
hidden before any of them sees it: `commandLineForLog` and `outputForLog` (`main/cm/hideSecrets.ts`) show the values of
`SECRET_OPTIONS` (`--pwd=`, which a Git sync takes) and a URL's password (`https://user:token@host`) as `•••`. A new
option that carries a secret joins `SECRET_OPTIONS`. `cm sync` takes the password only on its command line, so it
still shows in the process list while the sync runs; never pass a secret where `cm` offers a file instead.

The renderer is untrusted: windows run with `contextIsolation` and `sandbox` (`createMainWindow`), reach main only
through the one invoke channel, and never open a window of their own: a link that would opens outside the app
(`setWindowOpenHandler`, `shell.openExternal`).

## Own config

The app keeps its settings in its own store (`main/settings/SettingsStore`: `settings.json` in the user data folder).
It never writes to the official Desktop client's config (its settings folder, `plasticConfigFolder`: `plasticgui.conf`,
`client.conf`...) and never keeps reading it. Only on the first run, `importLegacySettings` reads the well-known values
there so the user feels at home (each workspace's recent branches, `readRecentBranchesByWorkspace`); it records
`legacySettingsImported` even when it found nothing or couldn't read a file, and never runs again: from then on the
app's settings are the only source. `main/settings/ownConfig.test.ts` checks statically that only the import reaches
that folder and that nothing there writes a file.

Not covered, as they aren't the official client's settings: what `cm` itself reads from its `client.conf` (the default
user `cm whoami` shows; `PendingChangesOnSwitchAction`, neutralized by `switchWithChanges`), the workspace's rule files
(`ignore.conf`, `cloaked.conf`, `hidden_changes.conf`) and `.plastic` metadata, and server objects the official client
created (its automatic shelves, offered as left changes). Its merge tools (client.conf's `<MergeTools>`) aren't
offered: the app finds the well-known tools itself, and the user adds any other (docs/features/merge.md).

## Operation progress

Long operations report a structured `OperationProgress` (`shared/domain/operation.ts`): a stage (`preparing`,
`calculating`, `downloading`, `uploading`, `applying`, `confirming`, `finishing`, or `working` in the app's words),
stable stage words, files and bytes done and to do, a fraction (or null), the file at hand, whether stopping is still
safe, and the step of a multi-command operation (shelve, undo, switch, bring). Never a raw `cm` line.

- Each command's output is read by a pure `ProgressReader` (`main/cm/progress/`), passed as
  `onOutputLine: context.progressOf(reader)`; the operation's `ProgressReport` (made by the `OperationTracker`) adds the
  step (`context.beginStep`) and throttles to ten reports a second, stage changes at once.
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

## Windows

One window per workspace, so several tasks (often one AI agent each, in its own workspace and branch) run side by side.

- `main/window/WorkspaceWindows` opens the windows; opening a workspace that another window shows brings that window
  forward instead (`windows.focusWorkspace`, checked by `useOpenWorkspace`). The installed app's first window reopens the
  last workspace used (`openFirst`); a new window opens on the home screen. A new window asked to open a workspace
  takes it at start (`system.takeRequestedWorkspace`), as does a folder the installed app is launched with on Windows
  and Linux (`workspaceArgument`; a second launch hands it to the running app). The first window waits until `cm` has
  found the workspace holding that folder (`handleLaunchRequests`), which may take longer than Electron takes to start.
  The Window menu lists them; closing the last one keeps the app on macOS, and the Dock icon opens the home screen (its
  menu offers New Window under the recent workspaces, `installDockMenu`); elsewhere it quits.
- The start-up (`main/index.ts`) is a few named steps; the wiring behind each (settings, watchers, own writes,
  operations, launch requests) lives in `main/startup/`, around the tested logic of the other folders.
- Each API call runs with its window as the caller (`main/ipc/caller.ts`, followed across `await`s), so its commands
  (`commandLogged`) and operation progress go back to that window only. `workspaces.watch` is the window saying which
  workspace it shows: `main/watch/WorkspaceWatchers` keeps one watcher per shown workspace and sends its changes to the
  windows showing it; own writes are ignored in the workspace they touch.
- Settings are written in main, one change at a time; values computed from the stored ones (the recent workspaces and
  branches) are computed there too, and every window gets the result (`settingsChanged`).
- What a window checks as it opens (`cm version`, `cm checkconnection`) runs until it succeeds once; later windows take
  that answer (`untilSucceeded`). A problem is checked again by the next window, and by Retry.
- "New workspace for a task" (`features/taskWorkspace`) creates a child of /main at its head (or takes an existing branch),
  a workspace next to the current one, and switches it (a plain `cm switch`: it's empty); a failure removes the new
  workspace and keeps the branch. The switcher shows the branch and pending changes of the other workspaces of the same
  repository with one local `cm status` each, only while it's open (`workspaces.glance`).
- A workspace reads the same everywhere it shows (the home screen, the switcher, the sidebar's workspace button): the
  repository's avatar (`components/RepositoryAvatar`: a white initial on a solid `--avatar-*` fill, picked by
  `avatarColor` from the repository's short name, the workspace's own until it's known; a neutral square while
  loading), then its branch (`SelectorChip`) and server (`ServerChip`, the whole `name@server`
  in its tooltip), told by `useDescribeWorkspace` (the `.plastic` folder, `cm` only for recent ones it can't tell). In
  the switcher's narrow rows the server gives way first, down to its icon, then the branch's name.

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

`lib/` and `ui/` never import from the tiers above them (`api/`, `app/`, `features/`, `components/`; `lib/` not from
`ui/` either): what they need from there is handed to them (`setAvatarPictureSource`) or lives a tier up
(`rendererTiers.test.ts` checks it).

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
- **Mutations**: `runOperation` (progress card, cancel, refresh) for long operations; `runAction` for quick ones. Both report errors as toasts.
  An update or a switch runs alone on its workspace: it waits for any other operation, and the others wait for it (`blockingOperation`).
- **Navigation**: a view per sidebar entry (`app/navigation/viewRegistry.ts`) and a stack of drill-down pages (`app/navigation/pages.ts`) such as history, diff or merge.
  A sidebar entry may show a count (`useBadge`) and a dot for something waiting there (`useDot`), whose words go under
  the entry's tooltip and in its accessible description: Changes' says what changes were left and where
  (`leftChangesSummary`, in the "Welcome back" banner's words).
  There is no Annotate page: "Annotate" outside the Files view opens the file's history annotated (`annotatedHistory`).
- **Actions**: menus and the command palette share the `Action`/`MenuEntry` model (`lib/actions.ts`). Register palette commands (and their shortcuts) with `useCommands`.
- **Menus**: one grammar for every object's menu (`lib/menuGroups`): the default action (what Enter does), what it
  does (switch, apply, check out), merges, what it creates, where it leads (history, annotate, browse, Show in Branch
  Explorer), the OS (open, reveal, terminal), the clipboard (Cut, one "Copy ▸", Paste), edits (rename, comments,
  hiding), and what undoes or deletes it last, in the danger tone; a separator between groups. Entries come from one
  vocabulary (`components/menuWords`: one id, icon, wording and group per concept) and `groupedMenu` orders them.
  One builder per kind (`branchMenu`, `changesetMenu`, `labelMenu`, `shelveMenu`, `codeReviewMenu`, `fileMenu`,
  `pendingChangeMenu`) serves every place the object shows: its view, details' "More actions", the Branch Explorer,
  the top bar's pill (right-click, `workingObjectMenu`), the switcher, the palette. A place only adds entries, at the
  end of their group (`withEntries`: the graph's "Go to head changeset"); the Branch Explorer leaves out "Show in
  Branch Explorer". "Copy ▸" (`copySubmenu`) lists what the object has in one order (name or number, title, paths,
  spec, full spec with `@repository`, comment, GUID), each with what it copies, and the toast names it ("Branch spec
  copied"); ⌘C in a list copies its first entry (`useCopyCommand`) unless text is selected. Items that open a dialog
  end with "…"; submenus hold real sets of choices. `menuGrammar.test.ts` checks every builder and every place.
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
  attribute (`useRenameCommand`); the context-menu key and Shift+F10 open a list's menu at its focused row. A field (`isTextEntry`) keeps
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
- **Filters**: every list's filter marks what made a row match, by the same rule. A filter field takes each word typed
  in any order, each found in one of the texts the row shows (`matchesWordFilter`; users by the name shown and as stored,
  `userFilterTexts`), and `HighlightQuery` marks those words in each cell; a path cut to fit finds them in the whole
  path first (`PathLabel`, `positionsInTrimmed`). Fuzzy finders (the palette, Go to file) pass the positions they
  ranked by (`fuzzyMatchPositions`). Text a row shows but its filter doesn't look at is never marked.
  - **One filter bar**: every view lays its filters out with `FilterBar`, whose slots fix the order: the text
    (`FilterField`, "Filter <things>", 240px), people, time (`SincePicker`, the presets of `lib/sincePresets`, any time
    last), kinds and statuses (`ToggleChip`, `ChoiceChip`, the Branch Explorer's Branches picker), then the view's own
    options at the end (layout, the graph's View). The text field is where ⌘F (and / from outside a text field) goes
    while it shows (`listFilter`, in its tooltip and the shortcuts sheet); ↓ goes on to the list and Esc empties it,
    then goes back to the list. Changes' and a diff's file filters take it too (`useChangeFilter(..., true)`); a list
    inside details keeps a plain `SearchField`; the command log keeps its own ⌘F.
  - **People**: `PeopleFilter` is the one people control: Mine, a click away, joined to a picker of anyone the list
    shows (`PeoplePicker` over `FilterChecklist`, which the Branches picker uses too: a search matching
    `userFilterTexts`, marked with `HighlightQuery`, Everyone and You first, then the people picked when it opened and
    the rest by name, avatars, several at once, only the rows in view rendered; ↑↓ move, Enter toggles, Space toggles
    once the arrows moved, Esc empties the search then closes). It reads the pick: "Ana Diaz +2", avatars stacked
    (`lib/peopleFilter`: `othersLabel`, `describePick`). The people offered come from the rows: a list read whole
    offers its owners, one read by people on the server everyone it showed this session (`usePeopleSeen`); no query
    lists people. Where the view reads a subset from the server (Changesets, Branches, Labels, Shelves, Code reviews)
    the pick goes into that same query (`pickedOwners`: `me` and names, sorted, one key per pick; `ownersCondition`
    ORs a few owner names, never ids, at most `MAX_PICKED_PEOPLE`), once picking pauses (`PICKING_PAUSE_MS`), and the
    rows already read narrow at once meanwhile (`matchesPeople`). Locks read only the user's (`--onlycurrentuser`)
    or everyone's, other people picked among everyone's; the Branch Explorer fades the others' changesets
    (`pickedNames`), History and Attributes filter what they read. Code reviews go by who created them; Assigned to me
    is a chip of its own. `cm find` fails on an owner it doesn't know, so only people from the rows are offered.
  - **Remembered**: each view keeps its filters in one store (`createViewFilters`): the time range, the kinds, the
    view options and Mine across sessions, the text and the people picked by name for the session (people differ
    between repositories); a page's (History) last as long as it. Older stores' `onlyMine` and the Branch Explorer's
    own date ranges are read into these (`restoredFilters`, `sincePresetOf`).
  - **Counts and empty lists**: the header counts what shows, "12 of 340" while filters hide some of what was read
    (`shownCount`). A list its filters empty says "No matching <things>" with Clear filters (`NoMatches`), which
    empties the text, shows everyone and turns the kinds off (`clear`, `isFiltering`); the time range stays, and the
    hint says when a longer one could find more (`longerRangeHint`). A list with nothing to filter keeps its own first-use empty state.
    Revealing a row the filters hide clears them (Show in Locks, the Branch Explorer's reveal).
  - The shelves list in Changes stays a quick list with "Mine | Everyone" (⇧⌘S), not a filter bar: it's a popover
    over Changes, and its "All shelves" hands its scope and text to the Shelves view.
- **Dialogs**: `openDialog`/`askDialog`, `confirm`, `prompt` — callable from anywhere, no local state plumbing.
- **List and details**: `ListWithDetails` (each view remembers its own details width, `widthKey`; a file tree keeps its own width instead, `sized="list"`) around a `DetailsPanel`. A view listing objects lays its body out with `ObjectListView` (the skeleton while loading, the error, its empty state, or the table with a row always selected and its details) and refreshes with `ViewRefreshButton`. Every
  kind reads the same way: the kind and status badges with the default action (what Enter does on the row) and the row's
  context menu behind "More actions"; a `DetailsHeading` (the comment's first line as the title and the rest as its
  description, or the object's name with the comment below; edited in place where cm can edit it, the title in a field that wraps and grows, and a comment left unedited saved as it was, `editedComment`; a name reads a size above a comment's title); a meta row (author ·
  date · spec to copy · branch chip); attribute chips (`AttributeChips`); properties and relations behind "More details";
  then the changes pane under a remembered splitter (`DetailsChangesPane`), its title a disclosure once the list is read
  that hides it and shows it again from the cache, remembered for every panel as More details is (`changesCollapsed`). cm edits changeset, attribute and label
  comments (a label's by applying it again to its changeset, `labelCommentArgs`); branch and shelve comments stay
  read-only: no `cm` command or client API edits them. Selecting a row must stay cheap (Server
  budget: Selection); the changed files' `cm diff` runs only on request (`ChangedFilesSection`). The panel's parts are
  primitives of their own in `ui/` (`DetailsSection`, `DetailsEmpty`, `DetailsSkeleton`, `DetailsBadge`,
  `DetailsCopyable`, `DetailsLink`, `DetailsDisclosure`, `MoreDetails`), each imported from its own module. Lists are
  a `DataTable` (`ui/table/`: only the rows in view render; the columns' sort, the keys' steps `selectionStep`, and
  `selectFirstRow`'s successor selection each in a module of their own).
- **Item rows**: every list of files and folders reads the same (`components/`): Files and Browse repository, Changes
  (after its checkbox), the files of every diff and details panel, the merge page, a task merge, Incoming, Go to file,
  the Undo dialog, the Locks view (a lock names no item type, and only files are locked). `ItemRow` lays out the icon, the name (cut first, in the middle as every path is: `PathLabel`), extras
  and, last on the row in one column, `ItemStatusMark`: the status letter (`StatusBadge`, the same tones and letters
  everywhere; its tooltip says what it means there), or a dot for a folder with changes inside. `ItemPathRow` is an item
  named by its path, the folders dimmed. Extras go in one order: tags (`ItemTag`: "modified", a merge), where a conflict
  stands (the merge page's icons, `ConflictStatusChip`, in Incoming too), the review mark, then `ItemMark`s by the
  letter, a quiet icon whose words are in its tooltip (`LockMark`: "Locked by ana in art-wk", someone else's in the
  alert tone; `XlinkMark`: "Xlink to nervathirdparty@17568"). A mark that leads somewhere is a button, its tooltip
  saying where, that keeps the row's click and selection out of it; the row's menu offers the same to the keyboard: a
  lock mark ("· click to see all locks") and the file's "Show in Locks" open the Locks view on that lock
  (`showInLocks`, selecting it through `selectInView` before going there). Nothing but ignored items dims: a private item keeps
  its icon, its name a step quieter, and wears its P; ignored (and cloaked) ones grey out, icon and name, with no
  letter in Files; deleted ones are struck through, reviewed ones fade (`faded`) but for their review mark. Files marks
  what is notable only (a pending change, a checkout, a private item: `itemDecoration`); a list of changes letters
  every row, as its filter chips do. In Changes every folder holds changes, so only its own change
  marks it. The merge page's letter is what the merge does to the item (a directory conflict's, what the source did);
  `cm merge` names no item types, so a path with others under it is a folder (`mergeItemTypes`). Locks are read for
  pending changes only (Files, Changes): other lists would need a `cm lock list` of their own. The Changes list renders
  its file and folder rows memoized with stable callbacks: holding ↓ over 100,000 changes re-renders none of them
  (0.5-0.6 ms a step).
- **File icons**: `ItemIcon` draws every file as the same filled Lucide page (`--icon-file` on `--icon-file-fill`) beside solid
  folders (directories and xlinks; `itemIconShape`), so every row reads with one weight; a glyph on the page tells the
  file's family (`fileFamilyOf`, by name
  first, then its longest extension: `Form.Designer.cs` before `.cs`), and only the glyph takes the family's tint
  (`FAMILY_GLYPHS`; its outline of the page stays neutral, found by its corners). The families are what matters in a
  change: what you write (source `<>`, scripts) in `--icon-source`; what builds it (`.csproj`, `.sln`, `.props`,
  `package.json`, `Cargo.toml`, `CMakeLists.txt`, `Makefile`, `.gradle`, `Dockerfile`, `.asmdef`: a cog) in
  `--icon-project`; what's generated for you (lockfiles, Unity's `.meta`, `*.g.cs`, `*.Designer.cs`) as the plain
  page, like an unknown type; config and data (braces) in `--icon-config`; images and media in `--icon-media`; Unity
  and other game assets (a box) in `--icon-asset`; docs, archives and binaries with a neutral glyph. Each tint is 3:1
  on the page in both themes.
  Already tried in the real rows and rejected, so don't propose them again: Material Icon Theme, Symbols, JetBrains New
  UI and Seti (glyphs of uneven weight, rows look unbalanced; gaps for Unity, Go, Rust, lockfiles), Fluent (one icon for
  all code, licensed for Microsoft-connected use only), file-icon-vectors and Phosphor (extension letters unreadable at
  16 px), catppuccin, vscode-icons, file-icons, and native icons (`app.getFileIcon`: a generic page for paths not on
  disk, bitmaps that ignore the theme, different on every OS).
- **Command log**: under the view past a `SplitPane` splitter, as tall as it was left (`COMMAND_LOG_HEIGHT`,
  remembered across sessions), the view keeping 200px. Its filter (⌘F or / from the log; "Failed" for failures only)
  is a list filter like any other (`commandLogFilterTexts`), kept for the session; each command is numbered by its
  place in the log since it was cleared (`NumberedLog`), so numbers stay put as the scope, the filter and the
  500-entry cap drop rows. Revealing a command the filter or scope hides clears them.
- **Styling**: CSS modules using the tokens in `styles/tokens.css`. No raw colors in styles or components
  (`styles/noRawColors.test.ts`, which lists the few colors written out on purpose); optional classes join with
  `classNames`.
  - Text tokens keep 4.5:1 and focus rings 3:1 (`styles/tokens.test.ts`); avatars' white initials 4.5:1 on every
    `--avatar-*` fill (one per `stableHue` hue, all weighing alike, `avatarColorOf`: people, workspaces and
    repositories alike), and server monograms' letters, a tint as secondary
    marks (`--tint-*`), 3:1 as status letters do. Branch headers set their text's lightness per hue to a contrast on
    their tint (`--branch-name-contrast`, `--branch-comment-contrast`, `hslAtContrast`), so the comment always reads
    quieter than the name, pale yellows as much as dark blues. Focus shows with `--focus-ring-visible`, or
    `--focus-ring-inset` on rows and panes (over their content when it would paint over the ring); filled controls
    draw `--focus-outline` 2px out, and state rules with a shadow of their own restore the ring (`focusRings.test.ts`).
  - Motion uses the `--duration-*` and `--ease-*` tokens and the shared keyframes of `styles/global.css` (through
    `--keyframes-*`); reduced motion zeroes the durations, so only loops (spinners, skeleton pulses) opt out themselves.
  - Lists that load show skeletons at their real row height (`ui/Skeleton`, `TableSkeleton`, `ListWithDetailsSkeleton`).
