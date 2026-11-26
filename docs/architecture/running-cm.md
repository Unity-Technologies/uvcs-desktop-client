# Running `cm`: routing and the server budget

How `CmClient` runs each command, and what each one may cost the server. The summary every change respects is in
`docs/ARCHITECTURE.md` ("How a request flows", "Server budget"); this file holds the details and the numbers. Read it
before adding or changing a `cm` call.

## How `CmClient` runs a command

`CmClient` runs every command, routed by duration and cancellability, never by read vs write. Starting a `cm`
process costs 100–150 ms before the command runs (macOS; more on Windows), while a warm `cm shell` answers a quick
command in a few ms:

- `query()` for quick commands, reads and small writes alike (a label, a rename, an undo of a few files): reuses
  pooled `cm shell` sessions, two per working directory; a command takes the first one free, and a directory idle
  for ten minutes lets its sessions go; a workspace no window shows anymore lets them go once their commands are
  done (`WorkspaceWatchers` `onStopped`), and the home folder's once a window opens a workspace and none shows the
  home screen (`showsHomeScreen`) and no window shows a workspace in the home folder itself. Each session is a
  process of about 80 MB, so a query with no `cwd` that answers the same in any directory (`profile list`,
  `profile delete`, `whoami`, `workspace list`, `status <path>`, `getworkspacefrompath <path>`) says so
  (`anyDirectory`) and runs in a workspace a window shows (`shownDirectory`), a ready one first, instead of
  starting the home folder's two; it starts them only when no window shows a workspace. A workspace is shown once
  its window watches it (`CmClient.show`, until `release`), and the first window's for `OPENING_SHOW_MS` from when
  its shells start ahead (`showWhileOpening`), so launch's profiles read runs there; one its page finds broken or
  missing is never watched, and its shells go when that time ends. A session takes about a second to answer its
  first command, so until one in that directory has, the query runs as a process of its own (the first window's
  start as the app loads: `readFirstScreenAhead`). A workspace write that may run long (`runsLong`: more than `MAX_QUICK_WRITE_PATHS`
  paths, recursive, or a transfer; a delete of more than `MAX_QUICK_COMMENT_DELETES` review comments) runs as a process of its own too, so it never holds a session every read of the
  workspace would wait behind. No quick command carries an option a `cm shell` keeps for its whole
  session (`--username`, `--server`, `-path`…: `STICKY_SHELL_OPTIONS`; docs/features/accounts.md "Options that stick
  to a shell").
- `execute()` for long or cancellable work (update, switch, checkin, shelve, merge, sync; the Branch Explorer's
  merges `find`, the slowest query on big repositories): a dedicated process that streams progress lines.
- A command that takes a process runs in a `cm shell` of its own, which reads its command line and exits after
  it (`processCommand`), for one of three reasons; anything else starts `cm` as it is:
  - It is an operation (`isOperation`: what changes the workspace, a shelve, a sync, a push or a pull), on every
    OS: `cm` counts a `cm shell`'s commands as the app's, and a plain process's as a script's. The shell's start
    costs about half a second, so the quick reads that take a process (a connection check, `version`, `cat`, a read
    before the pooled sessions are warm) don't run in one on macOS and Linux.
  - Its command line is too long to start a process with (a checkin or shelve of thousands of paths: Windows takes
    32,767 characters, quotes included): still one command, never split.
  - On Windows, it prints text (cm-output.md "Parsing `cm` output").
  A command with an argument a shell's line can't carry exactly (`canRunInShell`: a quote, a line break, leading or
  trailing whitespace, an empty argument) starts as it is whatever the reason; comments never do, since they go
  through `-commentsfile`. The shell reads `exit` after the command, so an operation never asks a question.
- A pooled command may take two minutes, a workspace write half an hour (a few paths can still be a whole tree).
- `queryRecords()` and `executeRecords()` run a command that prints `--format` records as `query()` and
  `execute()` do, routing included, and read each record as it arrives (cm-output.md "Records are read as they arrive"); `queryXmlElements()`
  reads an XML list element by element the same way (`cm history`), and `queryLines()` a list of one item a line
  (`cm listusers`).
- No output is held as one string unless it is a small answer (cm-output.md "No list is one string"): a list is read as
  it arrives with no size limit but one on the item still arriving (`MAX_ITEM_BYTES`), an answer stops past
  `MAX_TEXT_OUTPUT_LENGTH` (4 MB) with a `CmError` (`CmOutputTooLargeError`; a session starts a new process), and an
  operation keeps the ends of what it prints and is never stopped for its size.

The one `cm` run apart from it: `cm version` of a `cm` that doesn't run yet, the app's own just unpacked or an
installed one offered in Settings (`versionReader`, docs/features/cm-runtime.md), logged in the command log with
`CmClient.logEntry`.

Every command is logged and pushed to the window whose call ran it (`commandLogged`), for the command log panel
(renderer.md "Command log"), and written to the log file (main-process.md "The log file"); one that ended without an exit code
(stopped on a prompt, `cm` not found) is logged with -1, which the log and the error dialog word as "Stopped"
(`commandEnding`), and one its caller cancelled is not logged: it's no failure. One that gave up waiting is logged (its signal aborted with a `TimeoutError`:
`gaveUpWaiting`), as every read with a timeout is: a chip's read on another server, the repositories listed once
(`repositoriesService`), a workspace's repository (`workspaceRepositories`).

## Server budget

A large production repository holds ~280k changesets, ~20k branches, thousands of labels, shelves and reviews,
and many people use the same server. Every `cm` command other than local reads (`status`, `getworkspacefrompath`,
`workspace list`, `profile list`, `version`...) is server work, so each one has to earn its place:

- **One command for N things**: never run a command per row, file, branch or id in a loop. Read everything a view
  needs in one command that returns N records (one `cm find` per list, one `cm ls` of every conflicting file:
  `withConflictRepositories`), and a second command only for the few items the first couldn't answer
  (`repositoryPath`). Reads go through `CmClient.query()`, so they reuse a warm `cm shell` instead of starting a
  process; `execute()` is only for long, streamed or cancellable work. The exception is a local read (`LOCAL_COMMANDS`)
  that has no form for N, which runs once per workspace, never per row of a server list: the home screen's `cm wi`
  of each workspace (`workspaceHeadsReader`, "Home", below) and its `cm getworkspacefrompath` (`workspaceKindsReader`),
  the recent workspaces' `cm status --header` it couldn't tell (`workspaceRepositoryLookup`), and the switcher's two `cm status` of each workspace of the same repository, its
  header and its changes counted (`workspaces.glance`, `readWorkspaceGlance`). An `--xml` header still asks the server
  for the branch head (cm-output.md "`cm status` asks the server for its header").
- **Revisions asked together, one `cm cat` per batch**: every revision read by its spec (`content.read` of a
  `revision` or a `spec`: diffs, History, Incoming, a merge's conflicting files) goes through `RevisionCat`, which
  saves the reads asked together with one `cm cat <spec>;<file> <spec>;<file> …` per batch (`nextCatBatch`,
  `catGroupOf`: one repository each, an xlinked one's apart, as `cm cat` takes each repository's apart; revisions by
  id apart from items at a point; a command line Windows can start). What a batch saves is process starts and
  connections: merging 3,318 conflicting files runs 28 or 29 commands instead of 9,954 (measured on a local server).
  The server still looks up an item at a point (`itemid:N#cs:M`) on its own, one per revision; only a batch of
  revisions by id (`revid:`) is looked up at
  once. A read asked while no `cm cat` runs starts at once (`setImmediate`, no timer), as `cm cat <spec> --file=<file>`.
  At most `MAX_RUNNING_CATS` (2) run per workspace; the next batch is formed from what waits as one ends, another
  group's reads first, so a read another view asks for waits for one batch, never the whole queue. Up to
  `MAX_QUICK_CAT` (4) revisions (a diff's sides, a conflict's versions) go in a pooled `cm shell`, one such command at
  a time (a second waits for it: it answers in milliseconds). While what waits is at most `MAX_QUICK_BACKLOG` (64), it
  is all read so, a quick `cm cat` after another in one session, free between them for any other read: a small
  merge's few dozen versions in tens of ms, where a process costs 100-150 ms to start. Past it, batches go to
  processes of their own. `cm cat` writes every
  revision it finds even when one fails, and names each it doesn't: by its spec when it can't find it (`The specified
  revision was not found <spec>`), by its file when its content was purged (`purgedTargetOf`; diff.md "A purged
  version"). That read fails alone with its line, and when every line names one, the others were written whole. A failure that
  names nothing (a spec it can't take fails the command before it writes anything, a dropped connection) is narrowed
  down in halves (`narrowDown`): the half that fails again is split again, so one bad spec costs about two commands
  per halving, never one per read; when both halves fail, they all fail.

- **Sign-in**: a window coming forward checks its server's session (`cm checkconnection`) only when the last check is
  ten minutes old, one per server app-wide, which keeps the session alive; and a server that needs a sign-in gets no
  command at all until signed in again (docs/features/accounts.md "The gate").
- **Idle** (focused, nothing touched): only the incoming check, one `cm find changeset "... order by changesetid desc
  limit 101" --format={changesetid}{owner}` a minute (every five behind other apps, none while hidden). It takes the
  branch and loaded changeset from the workspace info, which follows `.plastic`, instead of asking `cm status`. It
  counts at most `INCOMING_CHECK_LIMIT` (100) changesets, the 101st telling there are more (`countCapped`, shown as
  "100+", `pluralizeAtLeast`): a workspace 100,000 changesets behind costs the server what one 100 behind does. A partial
  workspace's check reads only its branch head (`limit 1`), comparing its items again only when the head moved
  (docs/features/incoming.md "A partial workspace"). Nothing else polls: left changes, locks and lists wait for an
  event, a focus or an operation.
- **Incoming, by how far behind**: below the cap, the chip reads what the update collides with (`useIncomingChanges`:
  the newest page of changesets, `cm find ... limit 201`, the update's `cm diff cs:<loaded> cs:<head>` and the local
  `cm status`) once per head, to warn about conflicts before any hover, as the native client does, and its card lists
  the newest of what that read brought. That read is keyed by the branch, loaded changeset and head the check saw
  (`incomingChangesFor`, `incomingChangesQuery`): never stale, so focus and mounting never read it again, a new head is
  a new key (new changesets leave it alone, `isAffectedByNewChangesets`), and only an operation or Refresh reads it again
  under the same head. It waits for the check rather than run before it. It tells `cm` where the workspace stands, as
  the workspace info says (`incomingChanges(workspacePath, at)`, `workspaceLoadAt`), so it reads no `cm status
  --header`. So once per head it runs one find, one diff and one local `cm status --controlledchanged --changed`, which
  says what collides as it reads. After that, what collides follows Changes' pending changes whenever Changes read
  them after the incoming changes, never reading them itself (`useReadPendingChanges`): out of them, what `cm status --controlledchanged --changed` would print, each kind
  decided on its own (`localChangesForUpdateOf`; a checkout deleted on disk, which Changes lists only as deleted, is
  the one it misses, and updating checks again), the conflicts worked out again from the diff already read (`withLocalCollisions`,
  `findUpdateConflicts`), the same object while they come out the same. At "100+" a hover reads nothing heavy:
  the card reads its five newest itself (`cm find ... limit 6`, `cardReadsNewest`, `useNewestIncomingChangesets`) and
  says a click checks them against the local changes, then that it is checking or couldn't (`cardCheck`); pinning the
  card (that click), opening Incoming or Update reads the diff, Update again right before updating
  (`chipReadsIncomingChanges`). A card whose reads failed says so (`cardFailed`). Incoming reads the newest 200
  changesets with the incoming changes and "Show 200 more" (a button after the changesets, outside their listbox,
  reached with Tab: `IncomingShowMore`; pressed from the keyboard, the arrows go on from the first changeset read,
  `showMoreLanding`) reads the next older page (`changesetid <` the oldest shown, `useIncomingChangesetList`); what it
  reads is decided from the pages cached, not from the list's state, so it goes on after a visit elsewhere
  (`showMoreStep`), and a failed page says so once. Counts past what was read show as "200+". Those pages and the card's
  read are keyed by the head and left out of the automatic refreshes (new changesets, check-ins, updates, switches,
  focus: `isIncomingChangesetPage`, `staleTime: Infinity`): a new head is a new key. Refresh reads the newest page
  again; the older pages stay until the head moves. Once the incoming changes are in for the check's head, the chip, the
  sidebar, the status bar, the check-in note, the merge page and the success moment count with them, exactly once
  Incoming read every older page for that head (`knownIncomingSummary`, never lower): one count per screen.
- **Focus**: the incoming check if older than 20 s, and the server views on screen once stale (30 s by default). Lists
  that hardly change by themselves and are heavy to read use `SLOW_CHANGING_QUERY` (every branch, every label, attribute
  types, attribute values, the working object's comment, the palette's lists, the recent shelves in Changes, the user's and everyone's): five minutes, and focus never re-reads them. The Branch
  Explorer is kept five minutes and focus never re-reads all history. Local views (pending changes, the Files view,
  review marks, the workspace info) keep the client's 30 s too, so showing one again or in a second view reads nothing;
  focus never re-reads them while the watcher sees the whole workspace with auto refresh on, and always re-reads those
  on screen otherwise, however fresh (`localQueryDefaults`).
- **Home**: the repository and branch of every listed workspace come from a `cm wi <path> --machinereadable` of each
  (`workspaces.heads`, `workspaceHeadsReader`), a local read with no form for N ("One command for N things"): `cm` has
  no form that tells several workspaces at once (`cm workspace list --format` prints no selector), and `wi` only reads
  this machine (`LOCAL_COMMANDS`). Each is a few ms in a warm pooled `cm shell` that answers from any directory (before
  the pool is warm, a process each); one at a time across every window, so the directory's other session stays free
  for every other read. They are read again when a list shows once five minutes old
  (`SLOW_CHANGING_QUERY`); after the workspace a window shows moved to another branch, by an operation or a switch its
  watcher saw (`cm switch` in a terminal), they are only marked stale in that window (each has its own query client)
  and read as a list next shows there (`markWorkspaceHeadsStaleIfMoved`); the home screen's Refresh reads them at once;
  never on a window focus (`workspaceHeadsQuery`). Other windows' lists, and a switch of a workspace no window shows,
  wait for the five minutes. The app never reads `cm`'s own files in `.plastic`, whose format is `cm`'s to change
  (ARCHITECTURE.md "`cm` owns its files"). `cm` is asked about the repository again (`repositoryOf`) only for recent workspaces `wi`
  couldn't tell (or named by a Unity organization's id: cm-output.md "Unity organizations").
  How each listed workspace holds its files (standard, partial or dynamic: `WorkspaceKind`) comes from a
  `cm getworkspacefrompath <path> --format={type}…{dynamic}` of each (`workspaces.kinds`, `workspaceKindsReader`,
  `workspaceKindOf`), local too and taking the same one-at-a-time turns (`workspaceReadTurns`). A workspace's kind
  only changes when choosing what a standard workspace downloads makes it partial (main sends
  `workspaceKindChanged`), so each workspace's is one query kept for the session (`workspaceKindQuery`,
  keyed by its path and id): a workspace listed later costs only its own read. A kind `cm` couldn't tell shows as
  none, never as standard, and is asked again the next time it shows. How a partial workspace is created, chosen
  and kept partial: docs/features/partial-workspaces.md.
- **Selection**: arrowing through rows costs nothing; details ask once the selection settles (`useSettled`; `useSettledValue` for details that stay on screen as the selection moves, like a history's diff or any file's diff, `useDiffContents`, which shows a pair read before at once), `cm diff`
  runs only on request, and immutable results (what a changeset, shelve or branch head changed, revisions by id, specs
  pinned to a changeset or shelve, annotations of pinned revisions) are cached (`IMMUTABLE_QUERY`; off screen, the last 100 holding at most 256 MB of files, `boundUnusedQueries`; diff.md "Memory") and skipped by refreshes.
  An object opened from a list already read starts from it (`useChangeset`) and is asked for only once that list is stale.
  A changeset a list on screen holds is never asked for alone: it shows from the list and follows its re-reads, even
  while the list is stale (`changesetOnScreen`; a branch diff's list of changesets reads its list, not each
  changeset). Not `IMMUTABLE_QUERY`: a changeset's comment can be edited. A result that lasts only when its answer
  says so takes `immutableOnceRead` instead: the review mode key is a GUID for good, and asked again when it fell
  back to the place's path or spec (`isLastingReviewModeKey`).
- **After an operation**: `invalidateWorkspace` refetches what is on screen and marks the rest stale, scoped to what the
  operation can change (`refreshScopes.ts`, `runOperation({ affects })`, `runAction(..., affects)`): a checkin, an update
  or a merge from a branch leave labels, shelves, attributes, reviews, left changes and changesets already read alone;
  a merge into a server branch the workspace too, refreshing the incoming check instead (`isAffectedByServerMerge`);
  shelving changes that stay in the workspace refreshes only the shelve lists, and shelving them away those and the workspace; a new, deleted or hidden branch, or one whose comment was edited, only the
  branch lists and the Branch Explorer (the top bar's branch comment comes from a branch query); a label edit the labels and the graph; an attribute or value edit only the
  attributes; a code review created, edited, marked reviewed or deleted only the reviews (their lists and the branch chips); releasing a lock only the locks; deleting a shelve or discarding left changes only the shelve lists and the left changes, and applying or restoring one those, the workspace and its locks; adding, checking out, removing, undoing or reverting files only the workspace and its locks; restoring deleted items only the workspace (`isAffectedByRestoredItems`); a move recorded by hand (Search matches) only the workspace (`isAffectedByRecordedMove`); a changeset's comment edited only what shows changesets, and one moved or deleted those, the branch lists and incoming. Reads refresh nothing (`runRead`: the switch preflight, previews, opening a file); two operations in a row refresh once, after
  the last (create a branch and switch to it: `createBranchAndSwitch`). Views keyed by the workspace info (`keyedByWorkspaceInfo`: left changes, the
  incoming check, the branch the workspace is on) wait for it, and when the operation gave them another key they are only
  marked stale: they are read under the new key as they show, never once more under the old one. Event-driven refreshes
  are scoped too: someone else's checkin leaves labels, shelves, attributes, reviews and the workspace's own annotations alone.
- **Reuse**: what a command already returned answers later questions instead of another command. Code reviews name
  their branch by object id: the branch chips (Branch Explorer, Branches, finishing a task) match it against the ids
  their branch lists already carry, and share one review list with the palette; the sidebar's count on Merge requests
  needs no name and reads none (`reviewListSummariesQuery`). The Merge requests view and the review's page name it
  (`CodeReviewsApi.branchNames`) from the branch lists already read (`BranchNamesCache.remember`); else one branch
  alone, a review's page, is read by its id (`readBranchName`: `where id = N`, then among the hidden ones only when
  that finds none), and two or more read every branch's id and name once (`readBranchNames`, two light queries, kept
  ten minutes, and only while a window shows the workspace: `watchShownWorkspaces`). The top bar takes the branch
  comment from the branch query. The recent branches and renaming a workspace take its GUID and name from the reads
  the workspace info shares (`WorkspaceHeaders`). Pending changes share the Locks view's read of every lock
  (`locksQuery`), and ask which locks are mine only when some lock holds one of them. Left changes look the selector's
  object id up only when an automatic shelve by another client could match it. On a branch they take the id from the
  top bar's branch query (`leftChangesQuery`, `KnownBranch`), used only while the workspace is still on that branch
  (`selectorObjectRef`). Arriving from a switch looks for changes to restore only when this app left some there.
- **Revisions on disk: the disk first, the server last.** Every revision a view reads (Files' last change, History,
  a changeset's, branch's or shelve's diff, Incoming, update conflicts, a merge's destination version of each
  conflicting file, a model's `.mtl`, `.bin`, `.meta` and textures in any of them, both sides) follows one procedure
  (`WorkspaceCopies.read`):
  1. Which file, which version: the revision's workspace path and its id (the content source's `fileName`).
  2. Which revision does the workspace hold at that path, with what size and hash? A path the workspace already told
     answers at once, with no command (`rememberHeld`: the Files view's `cm ls` of its folders, a history's
     `cm ls` of its file, `workspaceItemArgs`), so a revision it doesn't hold there costs nothing. A revision
     another tree's listing named (Browse repository, a point's tree beside a model: `RepositoryTrees.fileAt`, the
     Materials look's in `RevisionDownloads`, a merge's destination tree: `withConflictRepositories`) is remembered with its hash (`remember`), never as what the workspace
     holds. Only for a path still unknown, and only when a file is there on disk, one `cm ls <folder> --format=…` of
     the workspace (`workspaceListingArgs`) tells, for all the folder's files (none for a folder the Files view
     listed: `rememberFolder`), kept until the watcher sees that folder's files change, or `cm` rewrite the workspace's
     state (`forgetChanged`); a listing asked before such a change marks nothing held (`generationOf`).
  3. Is it that revision, unchanged? Same revision id at that path, in the same repository, and the file's bytes have
     that size and MD5 (hashed as they are read, on the bytes returned; a file known to differ isn't read again until
     it changes). Then the disk's bytes are the revision's; otherwise it is downloaded (`cm cat`).

  Content decides, never status: a file changed, being written, missing, checked out (`cm ls` lists revision -1 and
  the disk's hash, so it holds no revision) or holding another revision is downloaded; when unsure, download. The
  listed `<Hash>` and `<Size>` are the loaded revision's, even once the file changed. A repository is matched by its
  whole spec, server included, as revision ids are per repository (`heldKey`): the hash checked is the workspace's
  revision's, so another server's same-named repository would pass. A Unity organization's server is named alike on
  every side compared (`cm ls`, `cm diff`, History's revisions through `withServerOf`: cm-output.md "Unity organizations"); a
  revision left by the organization's id, where `cm` couldn't name it, only misses its copy. A path under an xlink is listed with the xlinked repository's revisions. A workspace `cm ls` reads the workspace's
  metadata, never content; it is not a `LOCAL_COMMANDS` read all the same, as `cm` asks the server for the branches of
  what it lists (one call for all of them). Open, Save as and the merge tools copy a revision the workspace holds the
  same way (`saveVersion`).
- **Queries**: list everything only when the view needs everything, and then read it rarely. Otherwise filter on the
  server: a date (`sinceDate`), a `limit`, the people picked (`owners`), one object by name or id (`api.branches.get`). Never OR ids together
  (`where id = 1 or id = 2 …`, checked by `noOredIdLookups.test.ts`): take names and details from the query that lists
  the objects (`--format` fields, `{id}` in branch lists), or from one bounded query the view needs anyway. One
  exception, measured: the reviews of the branches a view shows, `targetid`s ORed in blocks of `BRANCH_REVIEWS_BLOCK`
  (`branchTargetsCondition`), which the server matches in one scan, so a block costs what one branch does
  (docs/features/merge-requests.md "Where a branch's merge request shows"). A list reads just the fields it needs, as
  records (cm-output.md "Records, not XML").
  Equivalent filters must share one query key (`compactFilter`). A parse failure must fail, never degrade to an empty
  filter (`parseWorkspaceStatus`): `cm find changeset where changesetid > -1` reads the whole repository.
- **Guards**: one thing is read once. The smoke test fails when the same command line is sent twice from the same
  folder within one step (opening the workspace, showing a view): one read under two query keys, or two features each
  reading what one already read. What it checks, what it leaves out and what it can't see: scripts/e2e/README.md,
  "Duplicate server commands".
  Development builds also warn in the console (`[server budget]`) when the same server command runs more than twice in
  ten seconds (`main/cm/repeatedCommands.ts`). A tighter window, a second run within 2 s, was tried and dropped: it
  flagged the reads a sign-in or a Refresh runs again on purpose, as it can't tell what caused a command.
