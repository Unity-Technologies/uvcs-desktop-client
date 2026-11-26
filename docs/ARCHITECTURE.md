# Architecture

A desktop client for Unity Version Control. The only backend is the `cm` CLI.

```
src/
  shared/     Types shared by both processes: domain model, API contract, events. No runtime deps (a test checks it).
  main/       Electron main process. Talks to `cm`, the file system and the OS.
  preload/    Exposes `window.uvcs` (invoke + events) to the renderer, and the few values the page needs before its
              first frame (`platform`). No other capability or channel.
  renderer/   React UI.
```

This file holds, in short, what every change must respect. The details and the numbers are in the docs below: read
the one for the layer you change, and the feature doc of the area you touch. A section here that has more says
where.

| Doc                             | Read it before you change                                                       |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `architecture/running-cm.md`    | A `cm` call: how `CmClient` routes it (`query()`, `execute()`, the pooled shells), and the server budget in full: batches, what runs idle and on focus, selection, refresh scopes, reuse, revisions read from the disk, queries, the guards |
| `architecture/cm-output.md`     | Reading a command's output or building its arguments: records, lists read as they arrive, where XML remains, `cm status`, Windows' code pages, macOS' NFD, what a check-in takes; xlinks; Unity organizations |
| `architecture/main-process.md`  | Errors, the log file, operation progress, windows (opening, closing, quitting, folder drops, new workspaces), start-up |
| `architecture/renderer.md`      | The renderer's conventions: one layout from the first frame, effects, data, refresh, mutations, the top bar, navigation, actions, prefixes, menus, keyboard, per-OS helpers, focus, dialogs, the command log, styling |
| `architecture/lists.md`         | Any list: filters, list and details, hiding the details, splitters, big lists, long names, item rows, lists of changed files, file icons |

Each feature area's own rules live in `docs/features/`:

| Doc                                     | Covers                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `features/diff.md`                      | Comparing two branches, changesets or labels, editing, the code's menu, discarding, stepping through changes, expanding a diff to the whole window, comparison methods, line breaks, images, review marks, highlighting memory |
| `features/model-diff.md`                | 3D models (FBX, OBJ, glTF): reading them as Unity imports them, what changed in Unity's terms, the 3D view, materials and textures where each version is, the disk or the repository at its point (`api.unityAssets`) |
| `features/merge.md`                     | The merge page, conflict resolution, external merge tools, finishing a task    |
| `features/incoming.md`                  | Incoming: changesets and their files, conflicts with your changes, updating    |
| `features/open-with.md`                 | Finding apps per OS, the editors and terminals, opening items in them          |
| `features/tools.md`                     | The user's tools: programs run on files, changesets, branches, labels and shelves; Settings › Tools; the official client's external tools |
| `features/shelves-and-switching.md`     | Switching with changes, a workspace on a shelve, shelves in Changes, two people on one branch |
| `features/files-history-annotate.md`    | Files, Browse repository, Go to file, cut and paste, history, annotate         |
| `features/branch-explorer.md`           | The graph's canvas, keeping the place, the pending changeset, the branch switcher |
| `features/updates.md`                   | The About dialog, reporting an issue, how the app updates (unsigned macOS too), What's New, releases, the app icon and CI |
| `features/changes.md`                   | Changes: Search matches, pairing a deleted item and a new one by hand as a move |
| `features/locks.md`                     | Lock rules: where they are edited, and why not in the app                      |
| `features/permissions.md`               | Permissions: the ACL model, `cm showacl`/`cm acl` quirks, the dialog, where it's reachable |
| `features/explore-repository.md`        | Exploring a repository without a workspace: the entry points, what its window shows and offers, Create workspace, links |
| `features/page-windows.md`              | A page (a diff, a history, a review) in a new window: where it's offered, how it belongs to its workspace window, Follow selection |
| `features/deep-links.md`                | `uvcs://` links: the grammar, the official client's older links, how a link opens, where links are copied, registering the scheme on each OS |
| `features/xlinks.md`                    | Creating and editing xlinks: where they point, writable ones, branch expansion rules, the `cm xlink` commands |
| `features/code-reviews.md`              | Code reviews: reviewers and the status each gives, the list's columns, the review's page and tabs, the conversation (threads, what's open, who may edit what), rounds (what's new since a reviewer's last status), suggested changes and applying them, email notifications, the `cm codereview` commands |
| `features/merge-requests.md`            | Merge requests: what makes a review one, creating one, the four states and who changes them, the page and its destination, the merge card and the conflicts check, merging and recording Merged, merge-rule refusals, the Merge requests view (State chip, who waits), which review stands for a branch: its chips, the top bar's chip and the next step in Changes |
| `features/rich-comments.md`             | Comments as Markdown: references to objects, people and emoji (`cr:` for reviews), chips, where comments show, copying, images; writing them (the editor, its keys, suggestions and their data, paste) |
| `features/issue-trackers.md`            | Issue trackers (Jira Cloud and Data Center, GitHub): connecting per user, each tracker's grammar and provider, secrets, issue references in comments and their chips, the trackers' request budget |
| `features/partial-workspaces.md`        | Partial workspaces: creating one empty, choosing what to download (`cm partial configure`), updates and merges that keep it partial |
| `features/cm-runtime.md`                | The `cm` the app runs: the installed one first, the pin as the floor (`cm-version.json`, `cm:bump`), the app's own store and setup, the setup and update screens, updates that bring their `cm`, Settings' choice |
| `features/accounts.md`                  | Accounts and sign-in: how profiles make accounts (a Unity account per user, one per server), Home's account switcher, Settings › Accounts; sign-in state, one per server: how `cm` says a server needs a sign-in, the gate that keeps commands from it, keeping sessions alive, the sign-in screen, operations refused and offered again |

## How a request flows

1. A component calls `api.<area>.<method>(...)` (`renderer/src/api/client.ts`), a typed proxy of `UvcsApi` (`shared/api`).
2. The preload forwards it over one IPC channel; `main/ipc/registerApi.ts` dispatches to the service.
3. Services (`main/services/<area>Service.ts`) build `cm` arguments and parse the output with helpers in `main/cm/`.
4. `CmClient` runs the command, routed by duration and cancellability, never by read vs write: `query()` for quick
   commands, reads and small writes alike, in a pooled `cm shell` (a process costs 100–150 ms before the command runs);
   `execute()` for long, streamed or cancellable work, in a process of its own. A workspace write that may run long
   (`runsLong`) takes a process through `query()` too. A list is read as it arrives (`queryRecords`, `executeRecords`,
   `queryXmlElements`, `queryLines`), never held as one string. No quick command carries an option a `cm shell` keeps
   for its whole session (`STICKY_SHELL_OPTIONS`).
5. Every command is logged and pushed to the window whose call ran it (`commandLogged`), and written to the log file.

How the routing works, the shells' lifetime, what takes a process and why: architecture/running-cm.md "How `CmClient`
runs a command".

To add a capability: its types in `shared/domain`, the method in `shared/api/<area>.ts` (part of `UvcsApi`), the
implementation in `main/services/<area>Service.ts` (wired in `createServices`), `cm` argument builders and parsers as
pure, tested helpers in `main/cm/`, then a query or mutation in the renderer through `api.<area>.<method>`. A method on
the server takes a `Place` and runs its commands through `cmPlace`, tested in a workspace and in a repository with none
("Places", below). The preload
and the IPC channel never change: the preload gains no capability or channel; besides `invoke` and `on` it exposes only
values the page needs synchronously before its first frame (`platform`).

## Places: a workspace, or a repository with none

What a window shows is a `Place` (`shared/domain/place.ts`): a workspace, or a repository explored without one. The
server's objects (branches, changesets, labels, shelves, attributes, code reviews, locks, diffs, histories, annotations,
a changeset's tree) read and change the same in both; only the disk (pending changes, switching, updating, merging into
the workspace, editing a file) needs a workspace.

- **APIs**: a method on the server takes a `Place`; a method on the disk takes a workspace's path, which a repository's
  place has none of, so the type checker keeps the disk out of a repository's window.
- **Commands are written once, through `cmPlace`** (`main/cm/cmPlace.ts`). In a workspace a command runs as it always
  has: in the workspace's folder, which tells `cm` the repository, its arguments as written. With no workspace each
  command names the repository itself: `cm find` ends with `on repository '<repository>'` (`findCommand`: anywhere but
  last `cm` fails, "missing EndOfFile"), specs end with `@<repository>` (`CmPlace.spec`; one naming its repository
  already, an xlinked item's, stays), a new branch or attribute is created by that spec (`CmPlace.newObject`: a bare
  name in a workspace), and `cm codereview` takes `--repository` (`CmPlace.repositoryOption`: without it, outside a
  workspace, `cm` fails with "Object reference not set to an instance of an object", after creating the review).
- **Outside every workspace**: a repository's commands run in an empty folder of the app's (`CmRunOptions.outsideWorkspaces`,
  `<userData>/outside-workspaces`), never in a workspace another window shows (`anyDirectory`): a command that forgot to
  name its repository fails ("Not on workspace") instead of reading, or changing, that workspace's repository.
- **The disk is a workspace's**: a read of its files, its loaded revision or a review snapshot asks `workspaceOf`, a
  bug told as one for a repository; `WorkspaceCopies` (revisions read from the disk) is asked only in a workspace.
- **Caches and queues key by place** (`placeId`: a workspace's path, `repository:<spec>` for a repository):
  `BranchNamesCache`, `RevisionCat`, `RepositoryTrees`, `RevisionDownloads`, `HandedOverDiffs`, the review mode setting.
  `BranchNamesCache` keeps a place's names only while a window shows it (its `isShown`): a workspace's while it is
  watched, a repository's while a window explores it (`WorkspaceWindows.explores`); the last window to leave it lets
  them go (`onRepositoryLeft`).
- **Windows key by place** too: one window per place (`WorkspaceWindows.windowShowing`, `samePlace`), page windows
  belonging to it, the session saving either (`SavedWindow.repository`). A window says it explores a repository
  (`windows.exploring`, `useRepositoryShown`) as watching a workspace says it shows one. The renderer's session holds
  the place (`useSession().place`; `workspacePath` is its workspace's, null while exploring), and each place has its
  screen on one layout (`PlaceLayout`: `WorkspaceScreen`, `RepositoryScreen`), its views (`showsView`, `viewsOf`) and
  its commands (`usePlaceCommands`, then `useWorkspaceCommands` or `useRepositoryCommands`).
- **The renderer** keys a place's queries `queryKeys.inPlace(place, …)` (a workspace's are `inWorkspace`'s, so every
  refresh scope reads both alike), refreshes them with `invalidatePlace` (`runAction` takes the place it changed), and
  gets the window's place from `usePlace()`, its repository and server from `usePlaceRepository()` and
  `usePlaceServer()`. `useWorkspaceInfo()` and `usePendingChanges()` are the place's workspace's: none for a repository.
- **Menus**: an object's menu takes the place; what needs a workspace takes its path (`workspacePathOf`), so it isn't
  there for a repository. The words whose action needs one are listed once (`NEEDS_A_WORKSPACE`, `menuWords`), and
  `menuGrammar.test.ts` builds every object's menu for a repository and checks none of them is offered.

Tried and dropped: a temporary workspace for a repository (the official client's way). `cm` makes only workspaces that
every client lists (`cm lwk`, the official client's home), and one a crash leaves stays there; the app would have
to special-case it wherever a workspace shows (watchers, recent workspaces, the session, the incoming check).

## Server budget

A large production repository holds ~280k changesets and ~20k branches, and many people share its server. Every `cm`
command but a local read (`LOCAL_COMMANDS` in `main/cm/repeatedCommands.ts`) is server work, so each one earns its
place. CLAUDE.md "Every `cm` command earns its place" asks the questions each answers (one command for N things, a
shell or a process, when it runs, how it's read, what it refreshes); architecture/running-cm.md "Server budget" holds
each rule in full, with the views it shapes (Incoming, Home, the Branch Explorer). Besides those:

- **Revisions on disk first**: a revision the workspace holds unchanged is read from the disk, never downloaded
  (`WorkspaceCopies.read`); those read by their spec go together, one `cm cat` per batch (`RevisionCat`).
- **Queries**: filter on the server (a date, a `limit`, the owners); never OR ids together (`noOredIdLookups.test.ts`);
  equivalent filters share one query key (`compactFilter`); a parse failure fails, never degrades to an empty filter.
- **Sign-in**: a server's session is checked at most every ten minutes app-wide, and a server that needs a sign-in
  gets no command until signed in again (docs/features/accounts.md "The gate").

## Parsing `cm` output

Each rule in full, with the quirks of each command: architecture/cm-output.md "Parsing `cm` output".

- **No list is one string**: every command says in `COMMAND_OUTPUTS` whether it prints a list (read as it arrives,
  item by item), an answer (read whole, refused past 4 MB) or an operation (its start and end kept, never stopped for its size).
  `query` and `execute` refuse a list, in `CmClient` and `fakeCmClient` alike.
- **Records, not XML**: a command that has `--format` is read as records, through a `RecordLayout` and `RecordReader`.
  XML remains only where `--format` can't say it (the `cm status` header, `cm fileinfo`, `cm history`). Never parse
  human-readable output when a machine format exists.
- **Text**: UTF-8 on every OS, CRLF turned into LF before any parser sees it. On Windows a process that prints text
  runs as a `cm shell` of its own (`printsInConsoleCodePage`); on macOS local paths go to `cm` decomposed
  (`inCmPathForm`).
- **Arguments**: multi-line text goes through temp files (`-commentsfile`), as a `cm shell` line can't hold quotes or
  line breaks (`canRunInShell`); `cm find` reads no quote inside a value (`withoutQuotes`).

## Xlinks

An item under an xlink lives in the xlinked repository, where ids and changeset numbers are its own, so a revision is
never a bare id: `RevisionRef` carries its repository, and every spec built from it names both. How each output names
the repository, and what can't be read through an xlink: architecture/cm-output.md "Xlinks". Creating and editing
xlinks: features/xlinks.md.

## Unity organizations

A Unity Cloud organization's server has a name (`AcmeStudio@unity`) and an id form (`2398571046213@cloud`). The app
never shows the id form, never compares it with a name and never passes it to `cm` (`fakeCmClient` fails a test that
does: `namesOrganizationById`); it takes the name from an output `cm` already names it in, never by mapping ids
itself. Where each name comes from, the two kinds of organizations, projects and deleted repositories:
architecture/cm-output.md "Unity organizations".

## No external tool opens by itself

`cm` never opens its merge or diff tool, and background work never opens anything. A merge tool opens only when the
user asks for it on one conflicting file ("Resolve in…") or on each in turn ("Resolve N conflicts in…"), one at a time,
and the app keeps the decision. An editor or a terminal opens only on the user's "Open in…" or "Open with"
(docs/features/open-with.md), and a tool only when the user picks it (docs/features/tools.md).

- `cm merge --merge` always carries `--nointeractiveresolution` and an explicit decision for every conflicting file
  (`fileConflictArgs`): workspace merges keep the destination and the app writes the resolutions; merges into a
  server branch hand `cm` each file's decision in a resolutions file (`--fileconflictsresolutionsfile`, docs/features/merge.md).
- Shelves are applied as merges from `sh:N` (never `cm shelveset apply`); `cm update` keeps `--dontmerge`;
  `cm diff` always has `--format`. `main/cm/noExternalUi.test.ts` checks these statically, and that processes start
  only to run `cm`, to ask the OS which apps are installed (`readInstalledApps`), to open an editor or a terminal or run a tool
  (`system/apps/launchApp.ts`, wired only in `createServices`), or from `main/merge/mergeTools/launch.ts`, imported
  only by `mergeToolsService` (which also runs Unity's Smart Merge through it, headless, before the tool the user
  asked for: docs/features/merge.md).
- `cm` processes run with stdin closed, so a console prompt fails instead of hanging. Some questions `cm` asks again at
  once when the answer it reads is empty (which system to sign in with, `Select your system [0-4]`), printing it again
  and again without a line break or a pause: `runCmProcess` stops such a command as soon as the end of its stdout is
  one question repeated (`RepeatedPromptWatch`), with the same "cm is waiting for input" failure a `cm shell` session
  gives a stalled prompt (`WaitingForInputError`, `main/cm/consolePrompts.ts`). A session's stdin stays open, so there
  `cm` waits for the answer, and the pause shows the prompt (`CmShellSession.watchForPrompt`). `CmClient` tells such a
  failure as a sign-in its server needs once a check confirms it, else as a `CmError` with its command
  (docs/features/accounts.md "The gate").

## Secrets

Every command is logged, sent to the window's command log and quoted in its `CmError`, so a secret passed to `cm` is
hidden before any of them sees it: `commandLineForLog` and `outputForLog` (`main/cm/hideSecrets.ts`) show as `•••`
the values of `SECRET_OPTIONS` (`--pwd=`, which a Git sync takes) and the whole user info of every URL
(a user and a password before the host's `@`, or a token alone as the user, as GitHub takes it, both read
`https://•••@host`; `withoutUrlUserInfo`, `shared/urlUserInfo.ts`). The same goes for the `[server budget]` and `[organization id]`
warnings, an error nothing caught (`textForLog`), every record of the log file ("The log file") and the lines a push, pull or sync shows as its progress
(`readActivityProgress`). An scp-like SSH remote (`git@host:path`), an `@` in a path and an `@` after a host with no path (an email beside a URL) are left as they are; an `ssh://` URL loses its user as any other. A new option that
carries a secret joins `SECRET_OPTIONS`. `cm sync` takes the password only on its command line, so it still shows in
the process list while the sync runs; never pass a secret where `cm` offers a file instead. The window's own titles
and toasts name a Git remote by the same rule, its user info dropped (`gitRemoteLabel`).

An issue tracker's credential (docs/features/issue-trackers.md "Secrets") is kept by main alone, encrypted with the
system's keychain (`safeStorage`, `TrackerSecrets`), or for the session only where there is none; it never goes back
to a window, and a token goes to main once, as it's signed in with. Every tracker request goes through `TrackerHttp`,
which sends a credential only to its connection's own origins, over `https:`, follows no redirect and sends no cookie.
The trackers' token shapes are hidden in any text logged (`TRACKER_TOKENS`).

The renderer is untrusted: windows run with `contextIsolation` and `sandbox` (`createMainWindow`), reach main only
through the one invoke channel, and never open a window of their own: a link that would opens outside the app
(`setWindowOpenHandler`, `shell.openExternal`). Only web pages open that way (`isWebAddress`): the OS would hand
any other scheme (`file:`, `smb:`, `ms-msdt:`) to a program. The programs the app starts for the user (custom
editors, merge tools, tools: `customEditors`, `customMergeTools`, `tools`) live in the settings the renderer writes, so
a renderer taken over could start a program of its choosing; that is accepted, since each is the user's own choice
made in the app's UI. Main still holds what reaches them to what the user asked: a tool runs only on the kinds of
objects it was set up for, and a revision's temp file stays in its own folder (`saveRevisionToTemp`). An issue
tracker's sign-in names its server from a link the window sends, so before a credential first goes to a host none of
the trackers' own nor a connection's, main asks the user in its own dialog, which the window can't answer
(`needsHostConsent`, docs/features/issue-trackers.md "Host consent").

## What leaves the device

Besides `cm`, which talks to the user's own servers, the app reaches the places below, and nothing else. A comment
can name an object on another server (`cs:4@game@build.example.com:8087`): its chip reads it from that server only
when it's one the user already works with (one of their profiles, `serverReads`) and only when the chip's card opens,
on hover or keyboard focus, in a process of its own (`remoteObjectQuery`, docs/features/rich-comments.md "What a chip
reads"). A server the user doesn't use is never contacted, as `cm` would sign in there with their own credentials,
and a comment never makes the app contact another server by being shown.
There is no telemetry, analytics or crash reporting: the log file stays on the device until the user attaches it to a
bug report ("The log file"). `PRIVACY.md` at the repository root is the app's privacy notice:
a change that sends anything new, or something more to any of these places, is flagged to the maintainers in its pull
request and never written into `PRIVACY.md` by the change itself.

- **Gravatar**, for profile pictures, only once the user chose to show them ("Profile pictures (Gravatar)").
- **GitHub**, for updates (`AppUpdates`, docs/features/updates.md).
- **The issue tracker the user connected** (Jira, GitHub; docs/features/issue-trackers.md "What leaves the
  device"), from main only (`TrackerHttp`): signing in, and the issues a comment shown names (a Jira binding's
  project keys, a GitHub server's repositories), read as the comment shows or a chip's card opens. Never a host a
  comment names, never from a place with no tracker connected.
- **Google**, for spell-checking dictionaries: Electron's built-in spellchecker is on by default (`createMainWindow`
  doesn't set `webPreferences.spellcheck`), and on Windows and Linux it downloads the Hunspell dictionary of the OS's
  language from Google's servers; macOS uses the system's spellchecker and downloads nothing.
- **The hosts of images a comment links to** (`![alt](https://…)`), only when the image shows: on hover over its chip
  or when the keyboard focus reaches it (`CommentImage`, docs/features/rich-comments.md "Images").
  Fetched by the page with no referrer, so the host learns the picture was looked at, never from where.

Otherwise the page reaches nothing: the renderer's Content-Security-Policy (`src/renderer/index.html`) allows only the
app's own files, `data:`/`blob:` images (profile pictures reach it from main as data URLs) and `https:` images for
those comments; no script, style or connection leaves it.

## Errors

Every error is the app's to tell, in its own UI; Electron's native error dialog never shows. Expected failures reach
the window as the API call's rejection and show as error toasts (`runOperation`, `runAction`) whose Details open
`ErrorDialog`; an error nothing caught is logged and shown as a toast, from main (`handleUnexpectedErrors`) or the
window (`reportUnexpectedErrors`), and the app keeps running; a render error shows `WindowErrorScreen`. Details:
architecture/main-process.md "Errors".

## The log file

Main keeps one log file for bug reports (`uvcs-desktop.log`, `appLog`): the launch, every command, errors nothing
caught. Secrets are hidden (`textForLog`), it never leaves the device by itself, and there are no crash dumps. A new
record is an event a bug report needs (`DiagnosticWriter.write`), never one per item, frame or keystroke. Details:
architecture/main-process.md "The log file".

## Own config

The app keeps its settings in its own store (`main/settings/SettingsStore`: `settings.json` in the user data folder),
replaced whole or not at all (`replaceFileSync`: a temp file renamed over it, tried again for a moment while Windows
says it's busy); a file that can't be read as settings is kept aside as `settings.json.<when>.bak` and the app starts
from the defaults.
It never writes to the official Desktop client's config (its settings folder, `plasticConfigFolder`: `plasticgui.conf`,
`client.conf`...) and never keeps reading it. Only on the first run, `importLegacySettings` reads the well-known values
there so the user feels at home: each workspace's recent branches (`readRecentBranchesByWorkspace`), which merge
tool opens which files (client.conf's `<MergeTools>`, `readLegacyMergeTools`, `legacyMergeToolSettings`;
docs/features/merge.md "Merge tools"), and its external tools and "Open with" programs (`externaltools.conf`,
`openwith.conf`: docs/features/tools.md). Each records that it ran (`legacySettingsImported`, `legacyMergeToolsImported`,
`legacyToolsImported`, apart since each came later) even when it found nothing or couldn't read a file, and never runs again: from
then on the app's settings are the only source. The import never writes a file (`main/cm/noCmInternalFiles.test.ts`).

Not covered, as they aren't the official client's settings: what `cm` itself reads from its `client.conf` (the default
user `cm whoami` shows; `PendingChangesOnSwitchAction`, neutralized by `switchWithChanges`), the workspace's rule files
(`ignore.conf`, `cloaked.conf`, `hidden_changes.conf`, `writable.conf`, `readonly.conf`), and server objects the
official client created (its automatic shelves, offered as left changes). Its diff tools (client.conf's
`<DiffTools>`) aren't imported: the app shows diffs itself.

## Where a setting is kept

Two stores, chosen by what losing a value would cost. The test: a value that costs a click to set again (a width, a
fold, a sort, a view toggle, a filter, a diff option) stays in the window; a value the user built up (rules, moved
branches, colors, a list of favorites), Settings' choices, and anything kept per repository, workspace or server go to
the app's settings.

- **The app's settings** (`settings.json`, `AppSettings`): what the user built up or chose in Settings, and anything
  kept for one repository, workspace or server. Every window reads them (`useSettings`) and follows the others' changes
  (`settingsChanged`); the main process writes them. They hold four scopes:
  - the whole app: Settings' choices, the changeset colors, the windows to reopen;
  - a repository (`repositorySettings`, `RepositorySettings` by `repositoryKey`): the Branch Explorer's rules and moved
    branches, whether its rules and changeset colors apply, the sync remote;
  - a server (`serverSettings`, `ServerSettings` by `serverKey`): the home screen's project;
  - a workspace: its recent branches (`recentBranchesByWorkspace`) and review mode (`reviewModeWorkspaces`).
  A value one window changes while another may change its neighbors (a repository's, a list's entry) is changed by the
  main process from the stored value (`updateRepositorySettings`, `updateServerSettings`, `rememberRecentComment`,
  `setFavoriteOrganization`), never written whole from a window's copy. A value of the whole app (a Settings choice, the
  changeset colors) is written whole (`saveSettings`): every window follows `settingsChanged`, so its copy is current
  but for a save still on its way. `scopedSettings.ts` keeps only what differs from
  having nothing, so the file holds only what the user set.
- **The window's storage** (`localStorage`, zustand's `persist`): only how the views are laid out, what costs a click to
  set again: splitter widths, folds, sorting, view toggles, filters, the diff's layout. Every window keeps its own copy
  of such a store and writes all of it back on any change, so the last window to change it wins: right for a layout,
  wrong for a map of places, where one window's write drops what another added.

`windowStorageHoldsLayoutOnly.test.ts` holds every stored store to a list (`LAYOUT_STORES`) that says why it's layout,
names every map such a store keeps and what it's keyed by (`KEYED_MAPS`), refuses one named for a repository,
workspace or server, and names the few sources that reach the storage
directly (`STORAGE_READERS`). What the window's storage kept before the settings held it (the Branch Explorer's version
2, the old sync and home stores) is handed to the settings at the next start (`bringStoredWindowSettings`,
`addWindowSettings`), which take it only where they hold nothing yet, and stays in the storage until they do. A value
cleared meanwhile reads as nothing held, so a hand-over that failed and is tried again at the next start may bring it
back.

### Settings survive renames

What the app keeps for an object is kept by what a rename never changes; a name changes, and what was kept by it is
lost. A workspace by its GUID (`cm getworkspacefrompath --format={guid}`, a local read), a repository by its GUID
(`{repguid}`), a branch by its GUID, a Unity project by its GUID. Each kind is a type of its own (`stableIds.ts`:
`RepositoryGuid`, `WorkspaceGuid`, `BranchGuid`, `ProjectGuid`), made only from text shaped as a GUID, so a name can't
be passed where one is kept.

- **A repository's GUID** is printed only by `cm repository list`, never by `cm status --header` or `cm find`, so
  every listing of a server goes through `RepositoryGuids`, which keeps its names' GUIDs for the session: the home
  screen's listing teaches them, and a name it doesn't know lists the server once more (a repository renamed or created
  since), at most once a minute. A replica on another server has a GUID of its own, and its own settings.
- **What each setting is kept by** is written in `settingsIdentity.ts` (`APP_SETTINGS_IDENTITY`,
  `REPOSITORY_SETTINGS_IDENTITY`, `SERVER_SETTINGS_IDENTITY`), one line per setting, which the type checker asks for
  when a setting is added. A path or a name is kept only where nothing stable exists, and its line says why: the
  folder a workspace opens from, a user (`cm` prints no id for one), a server of its own (its address).
- **What was kept by name before** moves to the object's GUID the first time the GUID is known, with no extra `cm`
  call.

## `cm` owns its files

The app asks `cm`, never reads what `cm` keeps for itself, whose format is `cm`'s to change: a workspace's metadata
(`.plastic/`: `plastic.selector`, `plastic.wktree`, `plastic.changes`, `changelists/`...) and the user's config folder
(`plasticConfigFolder`, `PLASTIC_HOME`: `client.conf`, `tokens.conf`, `profiles.conf`, `plastic.workspaces`,
`*.token`, `<guid>.key`, `globalconfig/`...). What a workspace works on is `cm wi`, its root
`cm getworkspacefrompath`, its changelists `cm status --changelists`. The few modules that name those files do so only
to watch, skip or look for them, or to tell `cm`'s words:

- the workspace watcher (`WorkspaceWatcher`, `classifyChange`): `.plastic` rewrites are refresh signals;
- `listWorkspacePaths`, which skips `.plastic`, and `describeDraggedFolder`, which takes a `.plastic` folder above a
  dragged one for a workspace while it's dragged (the drop asks `cm getworkspacefrompath`);
- `setupCheck`, which tells `cm`'s "client.conf not found" error.

Only the first-run import (`plasticConfig/`, `importLegacySettings`) reads one of them, once ("Own config"). The
workspace's rule files (`ignore.conf`, `cloaked.conf`, `hidden_changes.conf`, `writable.conf`, `readonly.conf`) aren't
`cm`'s but the user's: plain lines at the root, often checked in, and no `cm` command manages them; `filterRuleFile`
adds to them and the watcher skips the folders `ignore.conf` names (`readIgnoreRules`).
`main/cm/noCmInternalFiles.test.ts` scans the literals of every app source under `src/` (its `testing/` fakes aside)
for these names, and holds each module allowed to name them to exactly the file system functions its entry in
`ALLOWED` lists; a new one joins it with its reason, or asks `cm`.

## Profile pictures (Gravatar)

People show as their initials on their own color until the user chooses to see their Gravatar pictures, asked once;
nothing goes to gravatar.com before that choice, and only main fetches (`system.gravatar`). Details:
architecture/main-process.md "Profile pictures (Gravatar)".

## Operation progress

Long operations report a structured `OperationProgress` (`shared/domain/operation.ts`), never a raw `cm` line, read
from each command's output by a pure `ProgressReader` (`main/cm/progress/`). Stopping is offered only while it leaves
things as they were. Details, each command's quirks and the app icon's progress: architecture/main-process.md
"Operation progress".

## Windows

One window per place ("Places"); page windows belong to the window that opened them (features/page-windows.md). Each
API call runs with its window as the caller, so its commands and progress go back to that window alone. A window can
leave one workspace for another and keep its page, so a store holding a workspace's state keys it by the workspace's
path or says which workspace it belongs to. An operation changing a workspace holds quitting, and closing the window
that started it, until it finishes. Details: architecture/main-process.md "Windows".

## Start-up

The first frame is the window's final screen, themed, its data asked for before the first render; the first `cm`
reads start as the main module loads, before Electron is ready (`readFirstScreenAhead`). Only the app's own `cm` not
set up yet gates the first screen, and no server is asked at start-up. Measure with `scripts/perf/startup.mjs`. The
steps in order, and what was tried and dropped: architecture/main-process.md "Start-up".

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

A component decides nothing: what it shows, enables, orders or sizes from data is computed by a pure, tested `.ts`
module beside it, and the `.tsx` only maps the result to JSX (CLAUDE.md "Tests are the quality gate").

The conventions every view follows, in full in architecture/renderer.md and architecture/lists.md:

- **One layout from the first frame**: a view or page paints its final layout at once and keeps it while it loads,
  when nothing is there and when filters hide everything. A heavy library (Pierre, Shiki, three.js, CodeMirror) loads
  on first use, behind a `lazyComponent` (`startupBundle.test.ts`).
- **Effects survive a second mount**: StrictMode mounts every component twice in development, and a kept view's
  `Activity` runs every clean-up as it hides.
- **Data and refresh**: TanStack Query, keys under `queryKeys.inPlace` (`inWorkspace`). Views refresh on events, never
  on a timer but the incoming check; `runOperation` for long operations, `runAction` for quick ones.
- **Menus, actions, keyboard, focus**: one grammar for every object's menu (`lib/menuGroups`); menus and the palette
  share `Action`/`MenuEntry`; every shortcut is in `lib/shortcutRegistry.ts`; the list a view works on carries
  `MAIN_FOCUS`.
- **Lists**: one filter rule for every list, `ListWithDetails`, big lists render only the rows in view, long names fit,
  lists of changed files read and work the same everywhere: architecture/lists.md.
- **Styling**: CSS modules using the tokens in `styles/tokens.css`; no raw colors.
