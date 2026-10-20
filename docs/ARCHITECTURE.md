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
| `features/model-diff.md`                | 3D models (FBX, OBJ, glTF): reading them as Unity imports them, what changed in Unity's terms, the 3D view, materials and textures where each version is, the disk or the repository at its point (`api.unityAssets`) |
| `features/merge.md`                     | The merge page, conflict resolution, external merge tools, finishing a task    |
| `features/incoming.md`                  | Incoming: changesets and their files, conflicts with your changes, updating    |
| `features/open-with.md`                 | Finding apps per OS, the editors and terminals, opening items in them          |
| `features/shelves-and-switching.md`     | Switching with changes, a workspace on a shelve, shelves in Changes, two people on one branch |
| `features/files-history-annotate.md`    | Files, Browse repository, Go to file, cut and paste, history, annotate         |
| `features/branch-explorer.md`           | The graph's canvas, keeping the place, the pending changeset, the branch switcher |
| `features/updates.md`                   | The About dialog, reporting an issue, how the app updates (unsigned macOS too), What's New, releases, the app icon and CI |
| `features/locks.md`                     | Lock rules: where they are edited, and why not in the app                      |
| `features/permissions.md`               | Permissions: the ACL model, `cm showacl`/`cm acl` quirks, the dialog, where it's reachable |

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
     done (`WorkspaceWatchers` `onStopped`), and the home folder's once a window opens a workspace and none shows the
     home screen (`showsHomeScreen`) and no window shows a workspace in the home folder itself. Each session is a
     process of about 80 MB, so a query with no `cwd` that answers the same in any directory (`profile list`,
     `profile delete`, `whoami`, `workspace list`, `status --xml <path>`, `getworkspacefrompath <path>`) says so
     (`anyDirectory`) and runs in a workspace a window shows (`shownDirectory`), a ready one first, instead of
     starting the home folder's two; it starts them only when no window shows a workspace. A workspace is shown once
     its window watches it (`CmClient.show`, until `release`), and the first window's for `OPENING_SHOW_MS` from when
     its shells start ahead (`showWhileOpening`), so launch's profiles read runs there; one its page finds broken or
     missing is never watched, and its shells go when that time ends. A session takes about a second to answer its
     first command, so until one in that directory has, the query runs as a process of its own (the first window's
     start as the app loads: `readFirstScreenAhead`). A workspace write that may run long (`runsLong`: more than `MAX_QUICK_WRITE_PATHS`
     paths, recursive, or a transfer) runs as a process of its own too, so it never holds a session every read of the
     workspace would wait behind.
   - `execute()` for long or cancellable work (update, switch, checkin, shelve, merge, sync; the Branch Explorer's
     merges `find`, the slowest query on big repositories): a dedicated process that streams progress lines.
   - A command line too long to start a process with (a checkin or shelve of thousands of paths: Windows takes 32,767
     characters, quotes included) is written to a `cm shell` of its own instead (`processCommand`): still one command, never split.
     So is, on Windows, a command that prints text (see Parsing).
   - A pooled command may take two minutes, a workspace write half an hour (a few paths can still be a whole tree).
   - `queryRecords()` and `executeRecords()` run a command that prints `--format` records as `query()` and
     `execute()` do, routing included, and read each record as it arrives (see Parsing: records).
   - A command may print at most `MAX_OUTPUT_LENGTH` (256 MB) characters, shell or process: text output is read as one
     string, and V8 refuses strings past about 512 MB. Records are never one string; the limit counts their bytes, which
     bounds what reading them costs. Past it the command is killed (a session starts a new process)
     and fails with a `CmError` (`CmOutputTooLargeError`), never a crash. A list that can get there needs a
     server-side filter or a `limit` (Server budget: Queries).
5. Every command is logged and pushed to the window whose call ran it (`commandLogged`), for the command log panel
   (see Renderer: Command log); one that ended without an exit code (stopped on a prompt, `cm` not found) is logged
   with -1, which the log and the error dialog word as "Stopped" (`commandEnding`), and one its caller cancelled is not
   logged: it's no failure.

To add a capability: its types in `shared/domain`, the method in `shared/api/<area>.ts` (part of `UvcsApi`), the
implementation in `main/services/<area>Service.ts` (wired in `createServices`), `cm` argument builders and parsers as
pure, tested helpers in `main/cm/`, then a query or mutation in the renderer through `api.<area>.<method>`. The preload
and the IPC channel never change.

## Server budget

A large production repository holds ~280k changesets, ~20k branches, thousands of labels, shelves and reviews,
and many people use the same server. Every `cm` command other than local reads (`status`, `getworkspacefrompath`,
`workspace list`, `profile list`, `version`...) is server work, so each one has to earn its place:

- **One command for N things**: never run a command per row, file, branch or id in a loop. Read everything a view
  needs in one command that returns N records (one `cm find` per list, one `cm ls` of every conflicting file:
  `withConflictRepositories`), and a second command only for the few items the first couldn't answer
  (`repositoryPath`). Reads go through `CmClient.query()`, so they reuse a warm `cm shell` instead of starting a
  process; `execute()` is only for long, streamed or cancellable work.
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
  revision it finds even when one fails, and names each it doesn't (`The specified revision was not found <spec>`):
  that read fails alone with its line, and when every line names one, the others were written whole. A failure that
  names nothing (a spec it can't take fails the command before it writes anything, a dropped connection) is narrowed
  down in halves (`narrowDown`): the half that fails again is split again, so one bad spec costs about two commands
  per halving, never one per read; when both halves fail, they all fail.

- **Idle** (focused, nothing touched): only the incoming check, one `cm find changeset "... order by changesetid desc
  limit 101" --format={changesetid}{owner}` a minute (every five behind other apps, none while hidden). It takes the
  branch and loaded changeset from the workspace info, which follows `.plastic`, instead of asking `cm status`. It
  counts at most `INCOMING_CHECK_LIMIT` (100) changesets, the 101st telling there are more (`countCapped`, shown as
  "100+", `pluralizeAtLeast`): a workspace 100,000 changesets behind costs the server what one 100 behind does. Nothing
  else polls: left changes, locks and lists wait for an event, a focus or an operation.
- **Incoming, by how far behind**: below the cap, the chip reads what the update collides with (the update's `cm diff`
  and the local `cm status`, `useIncomingChanges`) once per head, to warn about conflicts before any hover, as the
  native client does, and its card lists the newest of what that read brought. At "100+" a hover reads nothing heavy:
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
  Explorer is kept five minutes and focus never re-reads all history. Local views skip focus while the watcher sees the disk.
- **Home**: the repository and branch of every listed workspace come from its `.plastic/plastic.selector` file
  (`workspaces.heads`); `cm` is asked only about recent workspaces whose file can't tell (or names a Unity
  organization by its id: "Unity organizations").
- **Selection**: arrowing through rows costs nothing; details ask once the selection settles (`useSettled`; `useSettledValue` for details that stay on screen as the selection moves, like a history's diff or any file's diff, `useDiffContents`, which shows a pair read before at once), `cm diff`
  runs only on request, and immutable results (what a changeset, shelve or branch head changed, revisions by id, specs
  pinned to a changeset or shelve, annotations of pinned revisions) are cached (`IMMUTABLE_QUERY`; off screen, the last 100 holding at most 256 MB of files, `boundUnusedQueries`; diff.md "Memory") and skipped by refreshes.
  An object opened from a list already read starts from it (`useChangeset`) and is asked for only once that list is stale.
- **After an operation**: `invalidateWorkspace` refetches what is on screen and marks the rest stale, scoped to what the
  operation can change (`refreshScopes.ts`, `runOperation({ affects })`, `runAction(..., affects)`): a checkin, an update
  or a merge from a branch leave labels, shelves, attributes, reviews, left changes and changesets already read alone;
  a merge into a server branch the workspace too, refreshing the incoming check instead (`isAffectedByServerMerge`);
  shelving changes that stay in the workspace refreshes only the shelve lists, and shelving them away those and the workspace; a new, deleted or hidden branch only the
  branch lists and the Branch Explorer; a label edit the labels and the graph; an attribute or value edit only the
  attributes; a code review created, edited, marked reviewed or deleted only the reviews (their lists and the branch chips); releasing a lock only the locks; deleting a shelve or discarding left changes only the shelve lists and the left changes, and applying or restoring one those, the workspace and its locks; adding, checking out, removing, undoing or reverting files only the workspace and its locks; a changeset's comment edited only what shows changesets, and one moved or deleted those, the branch lists and incoming. Reads refresh nothing (`runRead`: the switch preflight, previews, opening a file); two operations in a row refresh once, after
  the last (create a branch and switch to it: `createBranchAndSwitch`). Views keyed by the workspace info (`keyedByWorkspaceInfo`: left changes, the
  incoming check, the branch the workspace is on) wait for it, and when the operation gave them another key they are only
  marked stale: they are read under the new key as they show, never once more under the old one. Event-driven refreshes
  are scoped too: someone else's checkin leaves labels, shelves, attributes, reviews and the workspace's own annotations alone.
- **Reuse**: what a command already returned answers later questions instead of another command. Code reviews name
  their branch by object id: the branch chips (Branch Explorer, Branches, finishing a task) match it against the ids
  their branch lists already carry, and share one review list with the palette; the Code reviews view and page name it
  from the branch lists already read (`BranchNamesCache.remember`), or else read every branch's id and name once
  (`readBranchNames`, two light queries, kept ten minutes, and only while a window shows the workspace:
  `watchShownWorkspaces`). The top bar takes the branch comment from the branch query. The recent branches and
  renaming a workspace take its GUID and name from the reads the workspace info shares (`WorkspaceHeaders`). Pending changes ask which locks are mine only when some lock holds one of them; left
  changes look the selector's object id up only when an automatic shelve by another client could match it, and arriving
  from a switch looks for changes to restore only when this app left some there.
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
  every side compared (`cm ls`, `cm diff`, History's revisions through `withServerOf`: "Unity organizations"); a
  revision left by the organization's id, where `cm` couldn't name it, only misses its copy. A path under an xlink is listed with the xlinked repository's revisions. A workspace `cm ls` reads the workspace's
  metadata, never content; it is not a `LOCAL_COMMANDS` read all the same, as `cm` asks the server for the branches of
  what it lists (one call for all of them). Open, Save as and the merge tools copy a revision the workspace holds the
  same way (`saveVersion`).
- **Queries**: list everything only when the view needs everything, and then read it rarely. Otherwise filter on the
  server: a date (`sinceDate`), a `limit`, the people picked (`owners`), one object by name or id (`api.branches.get`). Never OR ids together
  (`where id = 1 or id = 2 …`, checked by `noOredIdLookups.test.ts`): take names and details from the query that lists
  the objects (`--format` fields, `{id}` in branch lists), or from one bounded query the view needs anyway. A list
  reads just the fields it needs, as records (Parsing).
  Equivalent filters must share one query key (`compactFilter`). A parse failure must fail, never degrade to an empty
  filter (`parseWorkspaceStatus`): `cm find changeset where changesetid > -1` reads the whole repository.
- **Guard**: development builds warn in the console (`[server budget]`) when the same server command runs more than
  twice in ten seconds (`main/cm/repeatedCommands.ts`).

## Parsing `cm` output

- **Records, not XML.** A command that has `--format` is read as records: a `RecordLayout` names the fields it prints
  (`layoutFormat`, `recordFormat`: control-character separators, no ambiguity with paths or comments) and
  `readRecords` reads each by name (`layoutReader`, the reader a streamed command takes too). Values arrive as printed
  with CRLF turned into LF (`parseRecords`); a layout trims the free text it shows (comments, titles, attribute
  values), as XML parsing did, and leaves the rest as printed: names, paths, and the Branch Explorer's, annotate's and
  diff's records, where whitespace matters. Only `cm diff` quotes some values (`unquoted`). Each layout is declared
  once: the `cm find` objects in `foundObjects.ts` (`FOUND_BRANCHES`...; `findArgs`,
  `findQueryArgs`), `FOUND_REVIEWS`, `FOUND_ATTRIBUTE_TYPES`, `TREE_ITEMS` for `cm ls` (whether a listed item has a revision is one rule for every `cm ls`
  reader: `listedRevisionId`). For 19,807 branches, records
  are 2.6 MB where `cm find --xml` printed 9.1 MB, and parse in a third of the time (26 ms against 77; 115 against 365
  for 100k, and past about 600k branches the XML passed `MAX_OUTPUT_LENGTH`). `--xml` also prints every field, some
  costing the server (`cm ls --xml` reads every item's GUID). A test writes the output as `cm` prints it for that
  layout (`recordsOutput`, `foundLine`). Anything with more than a few fields takes a `RecordLayout`; the small
  positional readers of two to four fields stay as they are (`parseWorkspaceListing`, `parseWorkspaceItem`,
  `parseBranchNames`, the incoming check, `parseAccounts`, the Branch Explorer's row builders `graphBranch`...).
- **`cm ls` on Windows**: it asks `--encoding` of `--xml` only, so its records come in UTF-8 only from a `cm shell`: a
  listing that can't take a pooled one starts a `cm shell` of its own (`processCommand`, about half a second more
  than an `--xml` process), and a server path holding a quote, which no shell line can hold, prints in the console's
  code page (`TREE_ITEM_FORMAT`).
- **Dates** in `cm find` come in `FIND_DATE_FORMAT` (`--dateformat=o`, ISO 8601 round trip, `findCommand`), which
  also sets how the query's dates are read: a day is spelled `roundTripDate` (`whereClause`). Without it `cm` prints
  the format its client config sets. `cm ls` takes `{date:o}`; it prints `0001-01-01…` for an item with no date.
- **XML remains** only where `--format` can't say it: `cm status` has none, and `--machinereadable` has neither the
  changelists nor the merge info (`parsePendingChanges`, `parseWorkspaceStatus`: a local read); `cm history --format`
  has no revision type, which tells text from binary from a directory, and a revision from a move or a removal
  (`itemHistoryArgs`); `cm fileinfo` reads one item or two, where records would save nothing (`parseItemDetails`,
  `removedItemSpec`). XML goes through `parseXml`.
- Never parse human-readable output when a machine format exists.
- **Records are read as they arrive**: new code reads a `--format` command with `cm.queryRecords(args, readRecord,
  options)` (or `executeRecords`), where `readRecord` builds a row (a branch, a changeset) from each record's fields, or
  `undefined` to leave it out. `RecordReader` takes stdout in byte chunks, from a pooled `cm shell` (`RecordOutput`)
  or a process (`runCmProcess`'s `records`), and reads each record once its separator arrives, keeping only the one
  still arriving: the output is never joined, copied for its CRLF, split into an array of records or held whole. A
  `cm find branch` of 1,000,000 branches (151 MB) costs the main process 451 MB of peak RSS instead of 722 MB, and
  427 ms instead of 566 ms, the rows holding 305 MB instead of 444 MB; 100,000 branches 79 MB of peak instead of 115 MB
  (Electron's V8, one run of `scripts/perf/records.mjs`; the figures here are all from it). The command's text output
  is what it wrote to stderr and what followed its last record (`takeRest`: nothing, a `CommandResult` line, an
  error), never a record: every `recordFormat` record ends with its separator, so what follows is a warning or an
  error, and a warning on stderr of a command that succeeded must not become a row. `CmError` and the command log show
  that output as for any command.
  - stderr is kept apart, as text: a write in the middle of a record would land in its fields or split a character.
  - Bytes, not text: the record separator is ASCII, which UTF-8 never uses inside a character of several bytes, so a
    record is found before it's decoded, and a character split between chunks stays whole.
  - Each record is decoded once (`toString` of its bytes) and split: its fields are slices of it, keeping alive their
    own record at most. Decoding each field on its own makes fresh strings but cost 30% more time than reading the
    whole output; slices of decoded chunks would keep every chunk alive. Sharing one copy of repeated owners and branch
    names (a `Map`) saved a tenth of the peak for a quarter more time, the record's string being alive anyway: dropped.
- Output already held as text (a cache's string, `ProfileList`; the callers read with `query()`, such as the `cm ls`
  listings, annotate, diffs and the services' lists) is read with `parseRecords(output, readRecord)`: the same field
  rules (`fieldsOf`), its records found in the string itself, with no copy into bytes (a million branches: 386 ms and
  581 MB of peak, where splitting the whole took 566 ms and 722 MB). Unlike `queryRecords`, it reads text after the
  last record as one more record, as it always did, so its callers read what they read before until they move to
  `queryRecords`.
- Values read from text output are slices of the command's whole output, which V8 keeps alive while any slice lives;
  values read as records arrive, slices of their own record. A cache that keeps them past the answer copies them as it
  keeps them, not every parser (`ownCopy`; `OwnCopies` for a value many entries repeat, like a repository spec):
  `BranchNamesCache`, `WorkspaceCopies`, `RepositoryTrees`.
- `cm find branch` leaves hidden branches out unless asked for (`hidden = 'true'`), and `cm find changeset` their
  changesets unless `ignorehidden = 'true'` (`branchExplorerFinds`; a list of one branch's changesets always asks for
  it, `changesetsService`); merges and labels come either way.
- Multi-line text (comments) goes through temp files (`-commentsfile`); `cm shell` cannot take quotes or newlines in arguments.
  Each is in a directory named with the app's process (`withTempDirectory`: `uvcs-<pid>-…`), deleted after the command;
  those a session killed mid-command left go as the next one starts (`removeLeftOverTempDirectories`, as the
  downloads' folders: `removeFoldersOfGoneProcesses`, only a process that is gone, never another app's running beside it).
- `cm find` reads no quote inside a value, neither doubled nor between double quotes: a search puts `%` in each quote's
  place (`withoutQuotes`), and so does an exact value (`equalsCondition`: `owner like 'o%brien@corp.com'`), whose caller
  keeps only the exact objects when it needs them. Branch, label, attribute and repository names can't hold a quote.
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
  revision (`rev:revid:N@repo`, `itemHistoryTarget`). A path known to be under an xlink (a model's sibling in a
  committed diff, a `repositoryPath` with its `repository`) is read from the tree at once (`saveFromTree`: one
  `cm ls <path> --tree=<point>`, then `cm cat revid:N@repo`), never by a `serverpath:` bound to fail; a merge
  change's version, not known to be under one, is looked up there once `serverpath:` finds nothing (a second command
  only for those). `cm ls --tree` takes a changeset or a branch (`listsTree`) and refuses a shelve or a label
  ("Incorrect object specification"): under an xlink, their unchanged files can't be read by path.
- `cm merge` prints conflicting files under a writable xlink with the xlinked repository's item id and changesets but
  not the repository: one `cm ls` of the conflicting files in the destination's tree names each one's
  (`withConflictRepositories`), only when some file conflicts.
- An item of another repository than the workspace's (`otherRepository`) keeps its changeset, branch and comment (read
  `on repository`), but leads to none of the workspace's views: no changeset diff, Branch Explorer, branch chip link or
  labels, and its changeset spec is copied with its repository.

## Unity organizations

A Unity Cloud organization's server has two names: the one people use, which `cm` prints and takes almost everywhere
(`AcmeStudio@unity`), and the organization's id, which UVCS keeps underneath (`2398571046213@cloud`). Both reach the
same repository, but as text they compare unequal, so the app never shows the id form, never compares it with a spec
by name, and never passes it to `cm`.

- **Where the id form comes from**: `cm status --xml` (its header's `<Server>` and `<WkConfigName>`), `cm history
  --xml` (each revision's `<Server>`; both are `cm` printing what it stores, a leak to fix in `cm`, which older
  versions keep), and the workspace's `.plastic/plastic.selector`, which keeps it by design. Everything else the app
  reads names it: the machine-readable status header, `cm wi`, `--format` outputs, `cm ls`, `cm fileinfo`, `cm diff`,
  `cm find`, `cm repository list`.
- **Where the app takes the name instead**, each from an output `cm` already names it in, never by mapping ids to names
  itself (`isOrganizationIdServer`, `main/cm/organizationIds.ts`, only tells an id apart):
  - The workspace's repository and server (`WorkspaceInfo`, `readWorkspaceStatus`): from
    `cm status --header --machinereadable` (`machineReadableHeaderArgs`), a local read
    run only when the `--xml` header printed an id (`serverByName`). The header is shared for a few seconds
    (`WorkspaceHeaders`). Reads that need only what is loaded take `readWorkspaceLoad`, which has no server to misuse,
    and the header as printed (`parseWorkspaceStatus`) holds the id only as `printedServer`. The header's branch is
    read whichever form its `<WkConfigName>` prints (`selectorName`). The switcher's glance at another workspace
    (`readWorkspaceGlance`) reads only its branch and pending changes: its row already shows the repository.
  - A file's history (`withServerOf`): from the item's repository, as the `cm ls` the history runs anyway names it
    (`workspaceItemArgs`, `{repspec}`), or the revision the history starts from.
  - The home screen (`parseSelectorFile`): a selector file that keeps an id names no repository (`WorkspaceHead`'s
    `repository` null), so the recent workspaces' lookup asks `cm` (`repositoryOf`, the machine-readable header),
    as for a file that can't be read: one query per workspace for the session (`workspaceRepositoryQuery`), two at a
    time across them in main (`workspaceRepositoryLookup`). Meanwhile, and for the workspaces past the recent ones,
    the row shows the repository's own name, which the file tells (`repositoryName`, `describedEntry`), and no server.
  Should `cm` not answer, the id stays rather than a guess.
- **What was saved under the id before**: nothing is migrated (that would be id-aware code to delete later). A
  shelve this app left on a Unity organization's workspace, recorded under the id, no longer matches the workspace's
  repository: it is offered as one another app left (adopted as foreign), its changelists are lost, and the folder
  where added files waited is no longer used to put them back. Review marks kept under the id's repository no longer
  show.
- **Kept so**: `fakeCmClient` fails a test whose code passes the id form to `cm` (`namesOrganizationById`; a profile's
  name is the id form itself, as `cm profile list` prints it, so `cm profile` is exempt), and development builds warn
  `[organization id]` in the console when a command does (`warnOnOrganizationIds`).
- Not done instead: reading `cm`'s own local table of organizations (a file in its config folder) duplicates what
  `cm` does and is the client's config, which the app doesn't keep reading ("Own config"); keeping a table in the app
  (learned once per organization) was tried and dropped for the same duplication; `cm profile list`'s names cover
  only organizations with a profile of their own, not those signed in through `*@cloud`.

## No external tool opens by itself

`cm` never opens its merge or diff tool, and background work never opens anything. A merge tool opens only when the
user asks for it on one conflicting file ("Resolve in…") or on each in turn ("Resolve N conflicts in…"), one at a time,
and the app keeps the decision. An editor or a terminal opens only on the user's "Open in…" or "Open with"
(docs/features/open-with.md).

- `cm merge --merge` always carries `--nointeractiveresolution` and an explicit decision for every conflicting file
  (`fileConflictArgs`): workspace merges keep the destination and the app writes the resolutions; merges into a
  server branch hand `cm` each file's decision in a resolutions file (`--fileconflictsresolutionsfile`, docs/features/merge.md).
- Shelves are applied as merges from `sh:N` (never `cm shelveset apply`); `cm update` keeps `--dontmerge`;
  `cm diff` always has `--format`. `main/cm/noExternalUi.test.ts` checks these statically, and that processes start
  only to run `cm`, to ask the OS which apps are installed (`readInstalledApps`), to open an editor or a terminal
  (`system/apps/launchApp.ts`, wired only in `createServices`), or from `main/merge/mergeTools/launch.ts`, imported
  only by `mergeToolsService`.
- `cm` processes run with stdin closed, so a console prompt fails instead of hanging.

## Secrets

Every command is logged, sent to the window's command log and quoted in its `CmError`, so a secret passed to `cm` is
hidden before any of them sees it: `commandLineForLog` and `outputForLog` (`main/cm/hideSecrets.ts`) show the values of
`SECRET_OPTIONS` (`--pwd=`, which a Git sync takes) and a URL's password (`https://user:token@host`) as `•••`. A new
option that carries a secret joins `SECRET_OPTIONS`. `cm sync` takes the password only on its command line, so it
still shows in the process list while the sync runs; never pass a secret where `cm` offers a file instead.

The renderer is untrusted: windows run with `contextIsolation` and `sandbox` (`createMainWindow`), reach main only
through the one invoke channel, and never open a window of their own: a link that would opens outside the app
(`setWindowOpenHandler`, `shell.openExternal`). Only web pages open that way (`isWebAddress`): the OS would hand
any other scheme (`file:`, `smb:`, `ms-msdt:`) to a program.

## What leaves the device

Besides `cm`, which talks only to the user's own servers, the app reaches three places, all listed with what they
receive in `PRIVACY.md` at the repository root. A change that sends anything new, or something more to any of them,
updates `PRIVACY.md` in the same pull request. There is no telemetry, analytics or crash reporting.

- **Gravatar**, for profile pictures, only once the user chose to show them ("Profile pictures (Gravatar)").
- **GitHub**, for updates (`AppUpdates`, docs/features/updates.md).
- **Google**, for spell-checking dictionaries: Electron's built-in spellchecker is on by default (`createMainWindow`
  doesn't set `webPreferences.spellcheck`), and on Windows and Linux it downloads the Hunspell dictionary of the OS's
  language from Google's servers; macOS uses the system's spellchecker and downloads nothing.

The page itself reaches nothing: the renderer's Content-Security-Policy (`src/renderer/index.html`) allows only the
app's own files and `data:`/`blob:` images, so profile pictures reach it from main as data URLs.

## Errors

Every error is the app's to tell, in its own UI; Electron's native "A JavaScript error occurred in the main process"
dialog never shows.

- **Expected failures** reach the window as the API call's rejection (`registerApi`: a `CmError` keeps its command,
  clipped as the command log clips it, both ends of its output kept: `clipForLog`), and the renderer tells them as
  error toasts (`runOperation`, `runAction`) whose Details open `ErrorDialog`, with "Report an Issue".
- **Main, nothing caught**: `main/index.ts` imports `errors/installUnexpectedErrorHandlers` first, so before any other
  module runs `handleUnexpectedErrors` listens to `uncaughtException` and `unhandledRejection` (a listener of the app's
  own is what keeps Electron's dialog away, and Node from ending the process on a rejection). Each one is logged with
  its stack, secrets hidden (`textForLog`), and sent to every window (`unexpectedError`) once per message. The app keeps
  running. Node warns that state may be inconsistent after an uncaught exception, but here the state that matters lives
  in `cm`, the disk and the settings file (written whole, `replaceFileSync`), and quitting would lose what the windows
  hold (unsaved edits, running operations) for no gain. Code that runs from callbacks, where no promise catches a throw,
  ends cleanly itself: `CmShellSession.guarded` wraps its stream listeners and timers, and a throw there (or a broken
  stdin pipe) fails the running command and starts a new process, as a stalled prompt does.
- **The window, nothing caught**: `reportUnexpectedErrors` (called first in `main.tsx`) turns the main process's
  `unexpectedError` and the page's own `error` and `unhandledrejection` events into one error toast per message,
  "Something went wrong", with "Report an Issue" (`unexpectedErrorIssueUrl`: the app's details and the stack, reviewed
  in the browser before sending). The stack never shows on screen. A render error shows `AppErrorBoundary`'s
  `WindowErrorScreen` (Reload, Report an Issue) instead of a blank window: one boundary around the screen, inside the
  dialogs and toasts so they keep working, and one around the whole app as the last resort.
- `unexpectedErrors.test.ts` checks that the handlers are main's first import, installed in one place, and that every
  timer of `CmShellSession` goes through `guarded`.

## Own config

The app keeps its settings in its own store (`main/settings/SettingsStore`: `settings.json` in the user data folder),
replaced whole or not at all (`replaceFileSync`: a temp file renamed over it, tried again for a moment while Windows
says it's busy); a file that can't be read as settings is kept aside as `settings.json.<when>.bak` and the app starts
from the defaults.
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

## Profile pictures (Gravatar)

People show as their initials on their own color (`ui/Avatar`, `avatarColorOf`) until the user chooses to see their
Gravatar pictures. Nothing goes to gravatar.com before that choice: it's a hash of each email address shown, and the
user decides whether it leaves the machine.

- **Off until chosen**: `showGravatar` and `gravatarChoiceAsked` both start false (`shared/domain/gravatarChoice.ts`).
  Pictures show only when both are true (`showsGravatar`), checked in one place, the main process's `system.gravatar`
  (`systemService`), which alone fetches (`GravatarCache`, `net.fetch`); the renderer only follows it
  (`useGravatarSetting`, `setAvatarPictureSource`). Only users named by an email address are ever looked up
  (`isEmailAddress`).
- **Asked once, when people show**: the first avatar of someone named by an email address marks people as shown in
  the window (`notePersonShown`, from `avatarImageFor`); the user's own account (the top bar, the account menu,
  Settings' accounts, `ownAccount`) doesn't, so the question never comes at launch with only the user on screen. Then
  a card in the toast corner (`GravatarPrompt` on `CornerCard`, `asksAboutGravatar`) asks "Show profile pictures?"
  with "Show pictures" and "Not now". While a dialog opened with `openDialog` or `askDialog` is open (`useDialogStore`:
  Settings, About, confirmations...; the command palette isn't one) it waits, so it never sits over the dialog's
  buttons, and shows again once the dialog closes. It has no close button and doesn't time out, as the question needs
  an answer: either one is saved with `gravatarChoiceAsked` (`gravatarChoice`), and it never asks again, in this
  window or another. Quitting without answering keeps pictures off and asks again the next time people show.
- **Settings › Appearance › People** turns pictures on or off at any time; that's a choice too (`gravatarChoice`).
- **Settings saved before the question existed** hold `showGravatar` without `gravatarChoiceAsked`, written with every
  other setting while pictures were on by default (`storedGravatarChoice`, read by `SettingsStore`): `true` may be
  only that default, which the user never chose, so pictures are off until asked; `false` can only be the user's own
  choice, kept as answered, so they aren't asked again.

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
  forward instead (`windows.focusWorkspace`, checked by `useOpenWorkspace`). The windows open as the installed app quits
  (`saveSession`, from `Quitting`: each one's workspace or home screen, bounds, maximized and full screen, the last
  focused one last; `openWindows`) open again at its next launch where they were (`openFirst`, `windowsToReopen`: one
  per workspace, none for a folder that's gone), the focused one in front and the others shown behind it
  (`showInactive`). After a restart to install an update, which nobody chose, each also opens on the view it showed
  (`Quitting.restartToInstall` saves `withViews`; the page reports each view it goes to, `windows.viewShown`, and reads
  it back from its address, `startingViewIn`); a launch of the user's own starts on Changes. Where the app quits as
  its last window closes (Windows, Linux), that window is saved as it closes (`Quitting.lastWindowClosing`). With none
  saved (on macOS, every window was closed before quitting), the first window reopens the last workspace used. Development builds start on one home screen, where automated UI checks pick a workspace. A new
  window opens on the home screen. A new window asked to open a workspace
  takes it at start (`system.takeRequestedWorkspace`), as does a folder the installed app is launched with on Windows
  and Linux (`workspaceArgument`; a second launch hands it to the running app). The first window waits until `cm` has
  found the workspace holding that folder (`handleLaunchRequests`), which may take longer than Electron takes to start.
  The Window menu lists them; closing the last one keeps the app on macOS, and the Dock icon opens the home screen (its
  menu offers New Window under the recent workspaces, `installDockMenu`); elsewhere it quits.
- A window that leaves one workspace for another keeps its page: `WorkspaceGate` mounts the views again, but the
  renderer's stores outlive the workspace. A store holding a workspace's state keys it by the workspace path
  (`useExpandedDirectories`, `useViewSelection`) or says which workspace it belongs to (`cutItemsIn`,
  `revealRequestIn`); otherwise the next workspace reads it, e.g. lists a folder only the last one has. The big part
  of what the window read of the workspace it leaves (for another one or the home screen) goes once its views unmount
  (`useForgetLeftWorkspace`, `forgetWorkspace`): what nothing shows of its immutable results (revisions, what
  changesets changed) and of every content its diffs read, its own files too (`content`, `contentBytes`,
  `diffContents`, whatever their source). Each window has its own query client, and a workspace's revisions, kept an
  hour, held hundreds of MB after the window moved on. Its lists and info are light and stay until their usual
  `gcTime`, so coming back within minutes asks the server nothing; only a content shown again is read again.
- The start-up (`main/index.ts`) is a few named steps; the wiring behind each (settings, watchers, own writes,
  operations, launch requests, the first window) lives in `main/startup/`, around the tested logic of the other
  folders. The order and what it waits for: "Start-up" below.
- Each API call runs with its window as the caller (`main/ipc/caller.ts`, followed across `await`s), so its commands
  (`commandLogged`) and operation progress go back to that window only. `workspaces.watch` is the window saying which
  workspace it shows: `main/watch/WorkspaceWatchers` keeps one watcher per shown workspace and sends its changes to the
  windows showing it; own writes are ignored in the workspace they touch.
- Quitting goes through one `before-quit` listener (`main/startup/quitting.ts`, `Quitting`). An operation changing a
  workspace (`OperationTracker.writesRunning`: update, switch, checkin, merge…) holds the quit back, as quitting would
  kill its `cm` partway: the OS's message box asks to quit once it finishes or to stay (`askToQuitWhenDone`), and with
  no window left (Windows and Linux quit as the last one closes) the app quits once it finishes. A slow read never holds
  it. Then the pages hear it (`quitStarted`), so one with unsaved edits asks Save / Don't save / Cancel first.
- Settings are written in main, one change at a time; values computed from the stored ones (the recent workspaces and
  branches) are computed there too, and every window gets the result (`settingsChanged`).
- What a window checks as it opens runs until it succeeds once; later windows take that answer (`untilSucceeded`), and
  a problem is checked again by the next window, and by Retry. `cm version` says `cm` runs (`CmUnavailableScreen`
  otherwise); `cm profile list`, a local command, says it's configured (`checkSetup`): without a configuration every
  command but `version`, `location`, `configure` and `help` fails at once saying so, and `SetupProblemScreen` takes the
  app's place. The check costs no command of its own: the accounts, the servers and it share one profiles read
  (`ProfileList`: everyone asking while it runs takes its answer, a removed account makes it `forget` a read started
  before, and once one succeeded `cm` is configured for the session). Unconfigured, that read runs as a process:
  `cm shell` refuses to start, so no session is ever ready. No server is asked at start-up: the home screen works
  without any. A workspace's server is checked as
  the workspace opens, `cm checkconnection <server>` with the server its info names (`checkConnection`, once per server
  until it answers), and a server out of reach or a failed sign-in show in a corner card naming it
  (`ConnectionProblemCard`, `connectionProblemShown`) while the workspace works with what's local. Checking the default
  server at start-up, and stopping the app on its failure, was dropped: it left a user offline unable to open even the
  home screen, and named no server, as `cm checkconnection` prints none.
- Dropping a folder on any window, home screen or workspace, opens its workspace in that window, or with Shift in a
  new one (`app/folderDrop`, as the official client does). The decision is `workspaces.findRoot`, a local
  `cm getworkspacefrompath`, so a folder inside a workspace opens it too; a folder that is no workspace goes straight to
  the new workspace dialog with its location filled in (a folder picked with Open workspace folder… asks first: `openFolder`).
  Only a single folder is taken; drops wait while a dialog is open. Chromium hides a drag's files from the page until
  the drop, so the overlay's words come from main (`system.draggedFolder`, asked once per drag): on macOS it reads the
  drag pasteboard with `osascript` (`readDraggedPath`, about 60 ms) and looks for `.plastic` in the folder or above it
  (`describeDraggedFolder`, no `cm`), and the overlay says "Open workspace" or "Create workspace"
  (`dropOverlayWording`). Windows and Linux have no pasteboard a process can read during a drag, so there, and until
  the answer comes, it says "Open or create a workspace". The words are a guess: the drop decides on the dropped path.
  The drag is followed on `window` by `nextFolderDragState` (enters minus leaves,
  ended for sure by a `dragleave` towards nothing, a drop or any pointer move), since an element's own
  enter and leave events don't pair up and left the overlay on screen.
  The overlay (`FolderDropOverlay`) fades out on a timer (`LEAVE_MS`), never on an animation event, so it can't linger.
- A workspace picked from a list (the home screen's rows, search and a repository's Open button, the switcher, the
  palette's workspace results) opens in this window, or in a new one with Shift held on the click or Enter
  (`windowAskedBy`, `workspaceOpener`; `workspaceInNewWindow` in the shortcuts sheet, the switcher's hints and the
  menu's key cap), the modifier a folder drop takes, and the one browsers use for a new window on all three OSs.
  With another modifier held too it opens here, and a missing workspace always opens here, whatever the keys: its
  screen locates, recreates or forgets it. The menu says the same: Open workspace, then Open in new window
  (`workspaceMenu`), but not a missing workspace's. The new window asks `windows.openWorkspace`, so a workspace another
  window shows comes forward instead; the new window remembers it as recent as it opens it (`useRequestedWorkspace`).
- A new workspace (the New workspace dialog: `createWorkspaceAndUpdate`) opens as soon as `cm workspace create` makes
  it, then gets the latest files of /main through the workspace's own Update (`updateWorkspace`: `cm update` in a process
  of its own, its progress card, its refreshes). `cm workspace create` already puts it on /main with nothing loaded, so
  there is no switch. A failed update leaves the workspace created and open, reported as any failed update. Recreating a
  missing workspace downloads its files the same way; a new repository's workspace isn't updated: it has nothing yet.
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

## Start-up

What a launch does, in order (measure it with `scripts/perf/startup.mjs`; `--timeline` shows what waits for what):

1. The main process's entry (`main/boot.ts`, package.json's `main`) turns Node's compile cache on, in the user data
   folder (`compile-cache`), then loads the app's bundle (`main/index.ts`), which V8 then compiles from what the
   previous launch cached: 5-10 ms sooner. It works from inside app.asar (Node reads the source through Electron's
   file system and keys each entry by its path and content), and the cache is skipped when it can't be used.
2. The main module opens the settings (the first run imports the official client's, `importLegacySettings`: a few
   ms), wires the services and, as it loads, before Electron is ready (`cm` needs neither that nor a window), starts
   the `cm shell`s of the workspace the first window reopens (or of the home folder, for the home screen) and that
   screen's first reads (`readFirstScreenAhead`, `readFirstScreen`): `cm version` and the workspace's info and
   pending changes, or the home screen's workspaces and servers. Their commands run while Electron gets ready (50-60
   ms) and the window and its page load; the page's identical calls take the answers (`EarlyCalls`, in
   `registerApi`; one nobody takes goes 5 s after the window opened, `EARLY_ANSWER_MS`, `expireUntaken`). A launch
   that names a folder on Windows and Linux (`launchNamesAFolder`, known as the module loads) reads ahead only
   `cm version`: its workspace, which `cm` finds, is read as the window opens (`openFirstWindow`). macOS names it later
   (`open-file`), so there the last workspace is read ahead anyway, and those answers expire unused (its shells, shown
   only while it opens, go after `OPENING_SHOW_MS` as no window watches it: `showWhileOpening`). A failed read
   ahead only means the window reads its screen as it opens. At `app.whenReady` the main process registers the API
   and opens the first window, and builds the menu bar right after creating it, before it shows. What `cm` logs
   before the window exists waits for it (`CommandLogRelay`), and the page's events sent while it still loads reach
   it once it has (`sendEventTo`), so its command log lists them.
3. The window is created hidden, its background the page's `--bg-app` (`WINDOW_BACKGROUND`), and names the workspace
   it opens in its page's address when the folder is there (`startingWorkspaceQuery`).
4. The page opens that workspace (`openWorkspaceFromAddress`) and asks for its first screen's data
   (`prefetchStartupQueries`) before its first render, and applies the theme as it renders (`useTheme`): its first
   frame is the themed workspace screen or home screen, never the home screen on the way nor a frame without colors.
   The window shows on that frame (`ready-to-show`): the first render is synchronous (`flushSync` in `main.tsx`,
   `firstRender.test.ts`), as React otherwise commits a root on a later task, after the page's first frame in most
   launches, and the window showed its background alone. Every view and page is in the startup bundle, the heavy
   libraries out of it ("One layout from the first frame", in "Renderer"): the bundle grows from 1.9 to 2.7 MB, the
   page's scripts run and the window shows 2-26 ms later (about 15), and Changes shows its data 6-70 ms sooner (about
   30), as it waits for no chunk (`scripts/perf/startup.mjs`, fake and real `cm`, warm and cold, interleaved against
   lazy views and pages).
5. `show()` holds the main process 35-55 ms (100+ when started from a terminal, which isn't the active app): what the
   page asks after its first paint waits behind it. That is why the page asks before rendering, and the main process
   earlier still.
6. Nothing else gates the first screen: `cm version`'s answer (the app shows meanwhile, `CmUnavailableScreen` only on
   failure), the local setup check once `cm` runs (`useSetupCheck`), the workspace's server check
   (`useConnectionCheck`), the watcher once the page watches, the highlighter warm-up 1.5 s later (`main.tsx`),
   avatars when rows show them, the menu bar (built by the first window opening, then once per burst of window
   changes: `appMenuInstaller`).

Reopening the last workspace on an M4 Max (Electron 44), started as the Dock does, warm, median of 14 runs, in ms
after the process starts, interleaved with a build from before the compile cache, the reads before `app.whenReady`,
the lazy updater and the synchronous first render (in brackets; two sessions): with the real `cm` on a local sandbox
the first paint comes at about 350 (360-386) and Changes shows its data at 425-530 (535-620); with the fake `cm` the
first paint and the data come within noise of before (about 350 and 370), as the fake answers before the page asks.
What remains: Electron's own start to `app.whenReady` (about 140), creating the window (about 45), loading the page
(about 105 to its first render, which its scripts include), and `cm status` as a process (300-350: the workspace's
shells answer only after about a second).

Tried and dropped, so they aren't proposed again:
- Showing the window as it is created (`show: true`): an empty frame shows 150 ms sooner, but `show()` then holds the
  main process while the page loads, which ran its scripts 150 ms later.
- Asking the main process which workspace to open (`takeRequestedWorkspace`), or awaiting the settings, before the
  first render: the wait paints an empty frame, the window shows on it, and `show()` holds the answer: the first
  render came 90 ms later.
- Minifying the renderer bundle (1.7 MB to 0.73 MB): the page's scripts ran 0-8 ms sooner, within noise.
- Serving the renderer from a custom `app://` scheme with V8's code cache (`codeCache: true`): deserializing the
  cache (12 ms on the page's main thread) replaced the compile Chromium streams off it, and the protocol handler cost
  10 ms more: Changes showed its data at 375, 381 and 378 ms over `file://`, the scheme, and the scheme with the cache.
- Preloading the Changes view's chunk before the first render, when views loaded lazily: 10 ms sooner with the fake
  `cm` only; with the real one `cm status` answers later and hides it. Bundling the views (step 4) was chosen for
  their first frame, not for the time.

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

- **One layout from the first frame**: a view or page paints its final layout at once and keeps it while it loads,
  when nothing is there and when filters hide everything; only what fills it changes.
  - Its header (title, count, actions, filters, switches) always shows. A filter over what is read waits, disabled,
    until it is read (`useChangeFilter`'s `reading`, History's text); filters that choose what is read (a time range,
    people, the kinds an object list asks for) stay live. A switch in a pane's header stays with it (`DiffFrame`: a branch diff's
    "Whole branch | Changeset by changeset").
  - Loading: the panes stay, with placeholder rows at the real row height under the list's own column titles
    (`ui/Skeleton`, `TableSkeleton`, `FileTreeSkeleton`, `FileTreeList`'s `loading`; a graph's bands, header cards and
    changesets at the graph's own measurements, `GraphSkeleton`), the details as
    `DetailsPanelSkeleton`, a viewer's pane blank. A list whose query hasn't started yet (it waits on the
    repository's name) is loading, never empty: TanStack's `isPending`, not `isLoading`.
  - Nothing there: the list keeps its pane (its count reads 0) and the empty state takes the details pane
    (`changesPanesState`, `objectListState`).
  - Filters hide everything: "No matching …" (`NoMatches`) in the list, under its column titles (`DataTable`'s
    `empty`, `FileTreeList`'s `noMatches`), beside a blank details pane: there is nothing to select.
  - A page whose subject isn't read yet shows its frame, the header a skeleton (`CodeReviewPage`).
  - The one shift left is a banner that says there is something to do, which shows only once that is known
    (Incoming's update bar).
  - Only an error reading the whole view, and an outcome that ends a page (not on a branch, nothing to merge), take
    the whole body.
  - Every view and page is in the startup bundle (`viewRegistry`, `pageRegistry`), so none paints a fallback it then
    replaces. A heavy library (Pierre, Shiki, three.js) loads on first use, behind a `lazyComponent` at the leaf that
    uses it (`FileDiffViewer`'s `LoadedFileDiff`, `AnnotationPane`'s `AnnotatedCode`, `FileConflictPanel`'s
    `ConflictBody`), whose fallback looks as that leaf does while its data loads; it joins `HEAVY_PACKAGES`, and
    `startupBundle.test.ts` fails on a static import that reaches one. The numbers: "Start-up", step 4.
- **Effects survive a second mount**: in development React's StrictMode mounts every component, runs its cleanup and
  mounts it again on the same DOM nodes. An effect that owns a resource builds a fresh one on each run and frees it in
  its cleanup, never leaving behind something its next run can't use: `useModelRenderer` gives each renderer a new
  canvas, as disposing one loses its WebGL context for good; `useModelScene` builds its scene in the effect, not in a
  memo. The production build runs each effect once and hides such a bug, so `npm run e2e` runs the smoke test over a
  development build too (scripts/e2e/README.md).

- **Data**: TanStack Query. Every workspace query key starts with `queryKeys.inWorkspace(path, ...)`, so `invalidateWorkspace(path)` refreshes everything after an operation
  (or what it can touch: `invalidateWorkspace(path, affected)`, `runOperation({ affects })`).
  A page opened from a list starts from the row that list already read, so it shows at once: a shelve
  (`cachedShelve`), a code review (`listedReview`, as `initialData` as fresh as that list, never from a list an
  operation marked stale).
- **Refresh**: views refresh themselves when something changes, never on a timer except the incoming check (the app's
  own update check runs hourly too, against GitHub, never the server: features/updates.md).
  - `main/watch/WorkspaceWatcher` watches an open workspace (recursive on macOS/Windows; on Linux a watch per folder,
    `FolderTreeWatch`, as Node's recursive mode there watches every file and loses files saved by replacing them;
    it walks the tree asynchronously, `FOLDERS_PER_STEP` folders at a time, so a big project never holds the main
    process, and `workspaces.watch` answers once every walk under way is done (the windows take the workspace as
    partly watched until then); once its first walks have watched every folder, the watch reports a file edit
    anywhere once, for the edits made in folders not yet watched (`ANY_FILE_EDIT`);
    an event Windows sends without a name, when a burst overflowed its buffer, refreshes everything),
    skips `ignore.conf` folders (on Linux the folders watched follow its edits, `followSkipRule`) and `.plastic` lock/temp files, coalesces bursts (300 ms quiet, 2 s max wait) and drops what the
    app's own writes cause (`changesWorkspace` commands and tracked operations): the renderer refreshes after those anyway.
    `cm status --changelists` writes the changelist files back on every read, so those rewrites count as its own too (`rewritesChangelists`).
    A watch that sees only part of the workspace refreshes local views on focus instead (`localQueryDefaults`), from the
    start ("Some folders here aren't watched") or once a watch breaks later (`workspaceWatchBroken`: one error toast per
    workspace and session, `noteBrokenWatch`; no polling).
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
- **Top bar**: one bar across the window on every screen (`app/shell/TopBar`), the sidebar under it: the window's
  buttons, the home button (`HomeButton`), then what the screen adds. A workspace adds its branch pill and
  incoming chip, the search and the account at the end (`WorkspaceTopBar`); the home screen adds nothing. Sidebars
  (`ui/nav/SidebarNav`) have no title band of their own.
  - Home is one click (or ⇧⌘H, `app.home`, File ▸ Home) from anywhere: in a workspace it leaves for the home
    screen, on the home screen it goes back to its welcome (`WELCOME`), where the house is lit. It sits in the top
    bar, not the sidebar, so it stays put whether the sidebar is folded or not and costs no sidebar entry. It is a
    borderless icon button, the bar's 8px gap on each side and nothing between it and the branch pill: a separator
    there, or a bordered square like the pill's, both looked off balance. It replaced the app's mark and name, which
    opened About: the welcome shows those, and the status bar's version opens About.
  - The way back: on the home screen, after the house, "‹ <workspace>" returns to the workspace the window left
    (`leftWorkspacePath`, `BackToWorkspaceButton`) on the view and pages it showed (`returnToWorkspace`: the
    navigation stays while on the home screen), as do Back (⌘[, Alt+←) and the mouse's back button. It shows only
    while `cm` lists that workspace (`workspaceToReturnTo`, from the list the home screen reads anyway).
- **Navigation**: a view per sidebar entry (`app/navigation/viewRegistry.ts`) and a stack of drill-down pages (`app/navigation/pages.ts`) such as history, diff or merge.
  A sidebar entry may show a count (`useBadge`) and a dot for something waiting there (`useDot`), whose words go under
  the entry's tooltip and in its accessible description: Changes' says what changes were left and where
  (`leftChangesSummary`, in the "Welcome back" banner's words).
  Folded (`toggleSidebar`, and always in a window under 1000px unless opened by hand: `useSidebarCollapsed`), the
  sidebar is a rail of tiles (`useInRail`), the home screen's too: each entry's icon over its label in `--text-xs`,
  two lines at most, balanced, a word too long cut with an ellipsis (an organization's name), or a short `railLabel`
  ("Expand", "All", "Local"); the selected tile as wide, its icon in the accent. The rail is 80px (`--rail-width`), so
  the longest one-word labels ("Changesets") fit on one line in every OS's font; labels wrap at the folded width from the start of the fold, so nothing jumps as it ends. The count is pinned in
  the accent over the icon's corner (99+ at most, `navBadgeText`), the dot at the tile's own corner. Tooltips only add
  what the entry doesn't show (`navItemTip`): the shortcut and the dot's words, and on a tile the whole count, the
  detail and a shortened label spelled out.
  The sidebar never scrolls, which the rail couldn't show: its groups show the entries that fit and a More entry after
  them (`NavGroups`, `shownItemCount`), whose popover lists the rest under their groups' titles; More looks selected
  while it holds the view on screen. It measures the entries as laid out (a tile's label may take two lines) whenever
  the sidebar's size or entries change, the ones in More kept laid out out of sight for that.
  There is no Annotate page: "Annotate" outside the Files view opens the file's history annotated (`annotatedHistory`).
- **Actions**: menus and the command palette share the `Action`/`MenuEntry` model (`lib/actions.ts`). Register palette commands (and their shortcuts) with `useCommands`.
- **Menus**: one grammar for every object's menu (`lib/menuGroups`): the default action (what Enter does in the app:
  open the workspace, a diff), every way to open it in other apps (the editor, the terminal, "Open with ▸", Reveal:
  `openOnDiskEntries`, docs/features/open-with.md; a file's Enter is its "Open in <editor>"), what it does (switch, apply, check out), merges, what it creates, where it leads (history,
  annotate, browse, a branch's changesets, Show in Branch Explorer), the OS (save a revision), the clipboard (Cut, one "Copy ▸", Paste), edits (rename, comments,
  hiding, permissions), and what undoes or deletes it last, in the danger tone; a separator between groups. Entries come from one
  vocabulary (`components/menuWords`: one id, icon, wording and group per concept) and `groupedMenu` orders them.
  One builder per kind (`branchMenu`, `changesetMenu`, `labelMenu`, `shelveMenu`, `codeReviewMenu`, `fileMenu`,
  `pendingChangeMenu`) serves every place the object shows: its view, details' "More actions", the Branch Explorer,
  the top bar's pill (right-click, `workingObjectMenu`), the switcher, the palette. A place only adds entries, at the
  end of their group (`withEntries`: the graph's "Go to head changeset"); the Branch Explorer leaves out "Show in
  Branch Explorer". One exception: the palette's code reviews of a branch have no "Switch to this branch", as its
  searches read reviews without branch names (`listSummaries`; naming them would read every branch,
  `BranchNamesCache`), while changeset and shelve reviews come named (`CodeReviewSummary.target`) and keep it. "Copy ▸" (`copySubmenu`) lists what the object has in one order (name or number, title, paths,
  spec, full spec with `@repository`, comment, GUID), each with what it copies, and the toast names it ("Branch spec
  copied"); ⌘C in a list copies its first entry (`useCopyCommand`) unless text is selected. Items that open a dialog
  end with "…"; submenus hold real sets of choices, the choice made checked after its label (`checked`), so the icon
  in front stays the item's own (an app's). `menuGrammar.test.ts` checks every builder and every place. A menu's
  content is in a portal, but React bubbles its events to the row its trigger sits in: `ActionDropdownMenu` keeps its
  clicks and mouse presses from reaching that row (picking from a changelist's "…" selected and folded it).
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
  `windowChrome`: macOS insets its traffic lights over the top bar's start; Windows hides its title bar and overlays
  its caption buttons on the top bar's end (`titleBarOverlay`, clear, symbols in the theme's text color; the page keeps
  `--caption-buttons-width` free), with a menu button at the bar's start (and Alt or F10) popping up the menu bar's menus;
  Linux keeps the desktop's frame and menu bar. Native parts follow the app's theme (`followAppTheme`). The menus
  (`main/window/appMenuTemplate`) have an app menu on macOS only; elsewhere File ends with Settings and Exit (Windows)
  or Quit (Linux), Help with Check for Updates and About, and `&` marks each item's Alt letter. The menus hold what
  a person looks for there: windows and workspaces (File), the branch work (Branch: switch, new, merges), the palette,
  the command log and the sidebar (View), the documentation, the shortcuts and reporting an issue (Help); what the
  screen already offers in place (updating the workspace: the incoming chip) stays out.
- **Focus**: the list, tree or graph a view or page works on carries `MAIN_FOCUS` (`lib/mainFocus.ts`). `useMainFocus`
  focuses it after navigating and whenever focus falls to the document (a dialog, menu or popover closed), and hands it
  list keys pressed while nothing has focus. A closing menu gives focus back to its trigger unless its action opened
  a dialog or put the caret in a field ("Check in this changelist": the comment), which keep it (`focusAfterMenu`;
  the action runs first, `runAfterMenuCloses`). Views keep their list's selection while away (`useViewSelection`).
  Lists expose ARIA roles (grid, tree, listbox) with `aria-activedescendant` on the focused container.
- **Filters**: every list's filter marks what made a row match, by the same rule. A filter field takes each word typed
  in any order, each found in one of the texts the row shows (`matchesWordFilter`; users by the name shown and as stored,
  `userFilterTexts`), and `HighlightQuery` marks those words in each cell; a path cut to fit finds them in the whole
  path first (`PathLabel`, `positionsInTrimmed`). Fuzzy finders (the palette, Go to file) pass the positions they
  ranked by (`fuzzyMatchPositions`). Text a row shows but its filter doesn't look at is never marked.
  - **One filter bar**: every view lays its filters out with `FilterBar`, whose slots fix the order: the text
    (`FilterField`, "Filter <things>", 240px), people, time (`SincePicker`, the presets of `lib/sincePresets`, any time
    last), kinds and statuses (`ToggleChip`, `ChoiceChip`, the Branch Explorer's Branches picker, Changesets'
    `BranchScopeFilter`; a picker's options above its list are `FilterOptions`), then the view's own
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
  - **Branch** (Changesets): one chip, `BranchScopeFilter`, for every branch's changesets, "This branch" (the one the
    workspace is on, followed as it switches) or any branch picked from the switcher's list (`branchSwitcherGroups`
    over `useBranches`, the every-branch read the switcher, the pickers and the palette share, asked for only once the
    popover opens); no query of its own lists branches. The branch goes into the view's `cm find` (`toQueryFilter`,
    `branch = '…'`), so "This branch" and the same branch picked by name share one query key. A branch picked by name
    says which workspace it was picked in (`PickedBranch`, `branchScopeIn`): the store outlives the workspace a window
    shows, and another repository may have no such branch. A branch's menu, in every place it shows the Branch
    Explorer included, opens the view on it ("Show changesets", `showBranchChangesets`). Both ways pick it alike
    (`pickedBranchFilters`): its whole history (Any time, capped) by everyone, the text emptied, and nothing the view
    remembers changed. The pick holds its own time range and people for the session, which the chips show and edit
    (`shownFilters`, `shownFiltersChange`); All branches, This branch or Clear filters drop it, and the remembered ones
    show again. Clearing the remembered filters, or picking with Any time written into them, was rejected: a "Mine ·
    Last month" user was left on "Everyone · Any time" for good, a heavier read on a big repository.
  - **Remembered**: each view keeps its filters in one store (`createViewFilters`): the time range, the kinds, the
    view options and Mine across sessions, the text, the people picked by name and what else holds the repository's
    objects (`forSession`: a branch picked by name) for the session, as they differ between repositories; a page's
    (History) last as long as it. Older stores' `onlyMine` and the Branch Explorer's
    own date ranges are read into these (`restoredFilters`, `sincePresetOf`).
  - **Counts and empty lists**: the header counts what shows, "12 of 340" while filters hide some of what was read
    (`shownCount`). A list its filters empty says "No matching <things>" with Clear filters (`NoMatches`), which
    empties the text, shows everyone and turns the kinds off (`clear`, `isFiltering`); the time range stays, and the
    hint says when a longer one could find more (`longerRangeHint`). A list with nothing to filter shows its own first-use empty state, in the details pane ("One layout from the first frame").
    Revealing a row the filters hide clears them (Show in Locks, the Branch Explorer's reveal).
  - The shelves list in Changes stays a quick list with "Mine | Everyone" (⇧⌘S), not a filter bar: it's a popover
    over Changes, and its "All shelves" hands its scope and text to the Shelves view.
- **Dialogs**: `openDialog`/`askDialog`, `confirm`, `prompt` — callable from anywhere, no local state plumbing.
- **List and details**: `ListWithDetails` (each view remembers its own details width, `widthKey`; a file tree keeps its own width instead, `sized="list"`) around a `DetailsPanel`. A view listing objects lays its body out with `ObjectListView` (the table with a row always selected and its details, a skeleton of them while loading, its empty state in the details pane, `NoMatches` under the column titles, or the error) and refreshes with `ViewRefreshButton`. Every
  kind reads the same way: the kind and status badges with the default action (what Enter does on the row) and the row's
  context menu behind "More actions"; a `DetailsHeading` (the comment's first line as the title and the rest as its
  description, or the object's name with the comment below; folded to a few lines with "Show more" and "Show less" by
  `FoldedComment`, which a diff's header shares, see `features/diff.md` "The diff's header"; edited in place where cm can edit it, the title in a field that wraps and grows, and a comment left unedited saved as it was, `editedComment`; a name reads a size above a comment's title); a meta row (author ·
  date · spec to copy · branch chip); attribute chips (`AttributeChips`); properties and relations behind "More details";
  then the changes pane under a remembered splitter (`DetailsChangesPane`), its title a disclosure once the list is read
  that hides it and shows it again from the cache, remembered for every panel as More details is (`changesCollapsed`). cm edits changeset, attribute and label
  comments (a label's by applying it again to its changeset, `labelCommentArgs`); branch and shelve comments stay
  read-only: no `cm` command or client API edits them. Selecting a row must stay cheap (Server
  budget: Selection); the changed files' `cm diff` runs only on request (`ChangedFilesSection`). The panel's parts are
  primitives of their own in `ui/` (`DetailsSection`, `DetailsEmpty`, `DetailsSkeleton`, `DetailsBadge`,
  `DetailsCopyable`, `DetailsLink`, `DetailsDisclosure`, `MoreDetails`), each imported from its own module. Lists are
  a `DataTable` (`ui/table/`: only the rows in view render; the columns' sort, the keys' steps `selectionStep`, and
  `selectFirstRow`'s successor selection each in a module of their own). Arrowing renders the view on every step, so
  it hands the table the same `rows` and `rowKey` until they change (memoized, or built outside the component), and
  the same `columns` when they sort: new rows or a new key make it key every row again, a new `sortValue` sort them
  again. The sort keeps each column's ranks by column id
  (`ColumnSorter`), so a new `sortValue` function costs a number sort, never comparing the rows' text again.
- **Big lists render only the rows in view**: anything a server can hold thousands of (branches, labels, repositories,
  users and groups) is virtualized, never a plain `.map` over every row: a 4,800-label `.map` built 29k DOM nodes and
  a 190 ms freeze on open. Pick from the virtualized pieces: `DataTable` for a view's list, `FilterChecklist` to check
  several in a filter's popover, `PickList` to pick one in a dialog (labels, users and groups: the search keeps the
  keys, `pickListKeys`), `BranchSearchList` for branches, and `RepositoryList` for the home screen's repositories,
  whose expanded workspaces are rows of the same flat list (`repositoryListRows`). The row holding the focus, or the
  one a field's `aria-activedescendant` names, stays rendered while it scrolls away (`keepRendered` in the
  virtualizer's `rangeExtractor`); a list whose rows take the focus themselves keeps it by the row's key, not its index
  (`repositoryRowIndex`), and acts on keys only from a row's own button, never its ⋯ menu's (`movesBetweenRows`). The filtering and sorting behind
  such a list is memoized on its inputs, so a hover or a key doesn't redo it (`memberCandidates` sorts once per list
  read). A suggestions list (`<datalist>`) holds the best few matches, never every object (`branchSuggestions`).
- **Long names**: branch names run past 120 characters (`/main/child-br-cr-sample/empty-branch2/child_1/subtask/merge-test`),
  so nothing that shows one may overflow, wrap a row or push another control out. Each place names a branch one of two
  ways, by what it does with it:
  - **In words** (a button, a menu item, a title, a sentence, a toast, a progress card, a breadcrumb): by its own name,
    `branchLabel` (`lib/branchLabels`: the last segment, cut in its middle past `MAX_BRANCH_LABEL_CHARS`; a menu item
    keeps fewer, `serverMergeLabel`), two side by side told apart by `branchLabels` ("Merge merge-test into subtask").
    The full name goes in the tooltip where the control has one.
  - **On its own** (a row, a cell, a chip, a header, a field's button): the whole path fitted to the room by
    `PathLabel` (parents dropped from the middle, `/main/…/child_1/subtask`, then the last parent cut rather than
    dropped while `MIN_CUT_FOLDER_CHARS` of it stay, `/main/child…mple/subtask`, the name cut in its middle last: the
    one rule for every path and branch, `trimFolderToFit`), the full name in its tooltip; the Branch Explorer's canvas
    the same way (`fitBranchName`, a tooltip on a cut name), the merge page's title both branches together (`fitMergeTitle`). A table cell may show just the own name, its tooltip
    the path (Changesets' Branch column).
  - The full path stays in words only where the user must know exactly which branch: the confirmation to delete it,
    the rename dialog's description, the new branch's "A child of …" and "Full name: …". There it wraps anywhere
    (dialog titles and text break long names, `overflow-wrap`) rather than overflow.
  - Underneath, nothing can grow past its container: a button's text label ends in an ellipsis at its container's width
    (`ui/Button`), a dialog's primary button gives way before Cancel does, and a split button before the row it sits in.
  `scripts/sandboxes/long-branch-names.sh` builds a repository with such names to check a change against.
- **Item rows**: every list of files and folders reads the same (`components/`): Files and Browse repository, Changes
  (after its checkbox), the files of every diff and details panel, the merge page, Incoming, Go to file,
  the Undo dialog, the Locks view (a lock names no item type, and only files are locked). `ItemRow` lays out the icon, the name (cut first, in the middle as every path is: `PathLabel`), extras
  and, last on the row in one column, `ItemStatusMark`: the status letter (`StatusBadge`, the same tones and letters
  everywhere; its tooltip says what it means there), or a dot for a folder with changes inside. A moved file that
  changed shows its C before its M (`StatusMark.changedLabel`, in a diff's header too), and both filter chips find it
  (`statusTones`). A moved item's name and its M show the move on hover, through the one tooltip
  (`data-tip-move-from`/`-to`, `PathMoveLines`): the folder both paths share said once ("in"), then one line each for
  where it was ("from") and is ("to"), what the move removed and added tinted as a diff tints them
  (`pathChangeSegments`); a line too wide is cut where nothing changed, folders first (`trimFolderToFit`), never wrapped
  (`fitPathParts`). Wrapping the two whole paths was tried and rejected: a long path broke inside what the move added,
  and the shared folder, said twice, hid what changed. `ItemPathRow` is an item
  named by its path, the folders dimmed. Extras go in one order: tags (`ItemTag`: a merge), where a conflict
  stands (the merge page's icons, `ConflictStatusChip`, in Incoming too), the review mark, then `ItemMark`s by the
  letter, a quiet icon whose words are in its tooltip (`LockMark`: "Locked by ana in art-wk", someone else's in the
  alert tone; `XlinkMark`: "Xlink to thirdparty@17568"). A mark that leads somewhere is a button, its tooltip
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
- **Lists of changed files** read and work the same everywhere: Changes, every diff (changeset, branch, shelve, code
  review: `DiffEntryList`), the details panels' changed files (`ChangedFilesSection`), Incoming and the merge page.
  - **One order**: by path, folder by folder, names as people read them (`file_2` before `file_10`, case only between
    names otherwise equal; different names read the same, "v01" and "v1" or a name in two Unicode forms, by their code
    units, so each folder's files stay together): `comparePaths` (`shared/pathOrder`), used where the files are read
    (`parseDiffEntries`, `parseMergePlan`) and by Changes (`sortChanges`, once a read: `useSortedChanges`; filtering
    keeps the order, and `layoutChangeRows` lays the changes out as they come). A list and a tree show the files in the same
    order. Ordering by kind of change first was tried and rejected: it split a folder's changes apart, and a row jumped
    to another group when its status changed; the status chips of the filter bar (`useChangeFilter`) are how to look at
    one kind. Sorting controls were rejected too: the only other order anyone asked for is by kind, which the chips
    give.
  - **One layout, List or Tree**, for every list at once and across sessions (`useFileListLayoutStore`, which took the
    one Changes kept first). Its switch, a menu (`FileListLayoutMenu`: it takes the room of one button), follows the
    status chips, so it is in the same place in each list; a details panel too short for a filter bar has it in its
    title. Only a list's own modes come after it (`useChangeFilter`'s `actions`: the review mode toggle).
  - **One tree**: `layoutPathTree` (`lib/pathTree`) lays out any items with a path, in n·log n: a folder's row, folders
    holding only the next one sharing it ("deep/very"), and a folder that is an item itself (an added or moved folder)
    as its own row, with its status. Every folder row is `TreeFolderLabel` (chevron, icon, name, and how many items it
    holds while closed); `FileTreeCell` indents rows to their level. A click, Enter, ← and → open and close folders
    (`pathTreeKeyMove`, `groupedTreeKeyMove`); a folder's menu and the review key act on everything in it
    (`itemsUnderRows`), and in review mode its mark marks every file in it, showing how far its review got ("2/5",
    `partialReviewCount`). Closed folders are remembered for the session per list (`useCollapsedFolders`: the Changes of
    a workspace, one diff, one details pane, one Incoming scope, one merge), so closing one in a changeset's diff leaves
    every other diff alone. A list is scoped by its workspace too (`folderListScope`): `/main/feature` or cs:3 name
    other things in another repository. A selection made from outside the list (a diff opened on a file, the merge
    page or a resolve run moving to a conflict) opens the groups and folders holding it, so its row shows
    (`useOpenToSelected`, `rowsHolding`); only a new selection opens anything, so a folder closed around it stays closed.
  - **One way to group**: a list whose files fall in groups (Changes' changelists, Incoming's conflicts with your
    changes and changes to apply, the merge page's conflicts and changes to apply) lays them out with
    `layoutGroupedTree` (`lib/groupedPathTree`): each group's header row (`TreeGroupLabel`: chevron, name, count, what
    it is as its tooltip), then its files as a list or a tree, a level in (`groupedRowLevel`). Groups close as folders
    do. A group only exists where the user acts on it differently; kinds of change are never groups, the chips filter by
    them.
  - **One list**: `FileTreeList` (`components/`) is every one of them but Changes, which adds checkboxes and drag and
    drop, and the details panes' short lists: the filter bar, then the rows, grouped or not (`useGroupedFileTree`,
    `useFileTree`), with a desktop list's selection of several rows and their menu, which acts on every item the
    selected rows stand for. A list renders its own rows (`DiffEntryRow`, `MergeItemList`'s) and adds its marks (a
    conflict's status, the review mark).
  - **One menu**: a file's menu is `changedFileMenu` (`components/`) in every list but Changes: its history (annotated
    or not), "Open this revision" and "Save this revision as…" for the version the list shows (a diff's newer side, a
    merge's incoming version; nothing to open for a deleted file or a folder), and Copy; a list adds its own after the
    shared entries of each group (a diff the review mark and, on the workspace's own history, reverting a file to before
    the change, `diffEntryMenu`, features/diff.md "Reverting a file"; a merge the ways to settle a conflict,
    `mergeItemMenu`). Nothing is read to build it: what Open and Save as take out of the repository is a
    `RepositoryVersion` (a revision, or a path or item at a changeset, as a merge knows its sides), read when they run.
  - **Folders once**: a folder added or deleted along with what it holds is left out, its items say it already, but a
    moved one stays, a move listing the folder alone (`withoutRepeatedFolders`, `lib/enclosingFolders`: `listedEntries`
    for a diff, Incoming and a details panel's changed files, so their counts agree; `buildMergeItems` for a merge).
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
  500-entry cap drop rows. A failed command shows how it ended ("Exit code 1", or "Stopped" without one) above its
  output. Revealing a command the filter or scope hides clears them. Its header shows the `cm` version the app runs
  (`cmVersionQuery`, already read at start).
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
  - Lists that load show skeletons at their real row height (`ui/Skeleton`, `TableSkeleton`, `ListWithDetailsSkeleton`),
    inside the layout they will fill ("One layout from the first frame").
