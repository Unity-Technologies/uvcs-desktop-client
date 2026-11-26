# Reading `cm` output

How the app reads what `cm` prints, the quirks of its commands, and the repositories an item can live in (xlinks,
Unity organizations). The summary every change respects is in `docs/ARCHITECTURE.md`; read this file before
parsing a command's output or building its arguments.

## Parsing `cm` output

- **No list is one string.** V8 refuses strings past about 512 MB, and long before that one string costs the main
  process what the whole output weighs, twice. So every command the app runs says what it prints
  (`COMMAND_OUTPUTS`, `cmOutputKind` in `main/cm/commandOutputs.ts`), and that decides how it's read:
  - a **list** (anything that grows with the repository, the workspace or the server: finds, `cm ls`, diffs,
    annotations, histories, pending changes, lock, profile, workspace and repository lists, the merge preview, an
    organization's members) is read as it arrives, `queryRecords`/`executeRecords` for `--format` records,
    `queryXmlElements` for an XML list (`XmlElementReader`), `queryLines` for one item a line with no `--format`
    (`LineReader`: `cm listusers`; `cm` writes errors to stderr, and a shell's `CommandResult` line is left out), and
    never stopped for its size. Only the item still arriving is kept, so one that never ends would be kept whole: past
    `MAX_ITEM_BYTES` (16 MB, far past any real record, line or element) the reader fails the command with a `CmError`
    (`CmItemTooLargeError`). `cm` asking which system to sign in with, its input closed, asks again and again without
    a line break, which a process stops sooner (ARCHITECTURE.md "No external tool opens by itself": `RepeatedPromptWatch`);
  - an **answer** (one small object: `whoami`, a workspace's header, an item's details) is read whole by
    `query`/`execute`, and stopped past `MAX_TEXT_OUTPUT_LENGTH` (4 MB);
  - an **operation** (a write: undo, add, checkin, update, merge, cat...) may print a line per item, so `query`/`execute`
    keep only its start and end (`TextLimit` `keepEnds`, `OutputBuffer`, the middle marked `leftOutMarker`), where
    `cm` prints its result and its error, and never stop it: stopping a checkin halfway is worse than any output.
    What a caller needs from a long run it takes from its lines as they arrive (`onOutputLine`, a line past
    `MAX_OUTPUT_LINE_LENGTH` given in pieces): a merge keeps the records that tell how it ended
    (`mergeOutcomeRecordOf`).

  `query` and `execute` refuse a list and a command missing from `COMMAND_OUTPUTS` (`textOutputKind`), in `CmClient`
  and in `fakeCmClient` alike, so a new list read as text fails its first test, and a new command says how it's read
  before it runs once. No code parses a whole output as records: `RecordReader` is the one way records are read, and a
  test reads an output string through it (`recordsIn`).
- **Records, not XML.** A command that has `--format` is read as records: a `RecordLayout` names the fields it prints
  (`layoutFormat`, `recordFormat`: control-character separators, no ambiguity with paths or comments) and
  `layoutReader` reads each by name. Values arrive as printed with CRLF turned into LF (`RecordReader`); a layout trims the free text it shows (comments, titles, attribute
  values), as XML parsing did, and leaves the rest as printed: names, paths, and the Branch Explorer's, annotate's and
  diff's records, where whitespace matters. Only `cm diff` quotes some values (`unquoted`). Each layout is declared
  once: the `cm find` objects in `foundObjects.ts` (`FOUND_BRANCHES`...; `findArgs`,
  `findQueryArgs`), `FOUND_REVIEWS`, `FOUND_ATTRIBUTE_TYPES`, `TREE_ITEMS` for `cm ls` (whether a listed item has a revision is one rule for every `cm ls`
  reader: `listedRevisionId`). For 19,807 branches, records
  are 2.6 MB where `cm find --xml` printed 9.1 MB, and parse in a third of the time (26 ms against 77; 115 against 365
  for 100k, and past about 600k branches the XML passed what one string could hold). `--xml` also prints every field, some
  costing the server (`cm ls --xml` reads every item's GUID). A test writes the output as `cm` prints it for that
  layout (`recordsOutput`, `foundLine`). Anything with more than a few fields takes a `RecordLayout`; the small
  positional readers of two to four fields stay as they are (`readWorkspaceListedItem`, `readWorkspaceItem`,
  `parseBranchNames`, the incoming check, `readAccount`, the Branch Explorer's row builders `graphBranch`...). A
  reader that needs every row before it can say anything (the repositories and projects, sorted apart) takes each
  record's fields (`readFields`) and folds them after (`repositoryListingOf`); one that only needs to remember what
  it saw keeps it as the records arrive (`AnnotationReader`, each changeset once).
- **`cm ls` on Windows**: it asks `--encoding` of `--xml` only, so its records come in UTF-8 only from a `cm shell`: a
  listing that can't take a pooled one starts a `cm shell` of its own (`processCommand`, about half a second more
  than an `--xml` process), and a server path holding a quote, which no shell line can hold, prints in the console's
  code page (`TREE_ITEM_FORMAT`).
- **Dates** in `cm find` come in `FIND_DATE_FORMAT` (`--dateformat=o`, ISO 8601 round trip, `findCommand`), which
  also sets how the query's dates are read: a day is spelled `roundTripDate` (`whereClause`). Without it `cm` prints
  the format its client config sets. `cm ls` takes `{date:o}`; it prints `0001-01-01…` for an item with no date.
- **`cm status` as records**: it has no `--format`, but `--machinereadable` with control-character separators
  (`statusRecordsArgs`) prints records `RecordReader` reads as they arrive (`PendingChangesReader`): a `STATUS` record,
  with `--changelists` each `CHLIST <name> <description>` before its changes, each change as `<codes> <path> <is
  folder> <merges>` (a move `<codes> <similarity> <old path> <path> …`), with `--compact` ("`cm status` asks the
  server for its header", below). 100,000 changes print 9 MB where `--xml` printed 60 MB, in half the time (0.9 s against 1.8 s; 500,000: 46 MB in 4.6 s against
  300 MB in 9 s, past what one string could hold). A change prints every code of the item at once (`CH+MV`):
  `listedCodes` reads it as `--xml` listed it (a deleted item is only deleted, an added one only added; an item in no
  category, a cloaked folder, isn't listed). Its paths are absolute, from the root `cm` keeps, which may differ from the
  app's in case, composition or a link resolved (`PrintedWorkspacePaths`); an item printed twice is one change with
  both kinds, as `--xml` merged it (a deleted file whose path a new file took prints `PR` then `DE`, and stays a
  deletion; one in several changelists is in the first); a change with other fields than these fails the read rather
  than show a clean workspace; merges are joined by `+` (`Merge from 3+Cherrypick from 7`), shown joined by `, ` as `--xml` did; the
  similarity comes in `cm`'s culture (`85,5%`). Records hold no size, date or file type: Changes reads the size, the
  date and whether a file is a link from the disk as the records arrive (`DiskDetails`, a local read; what `--xml`
  reported was the disk's too), and tells no binary file from a text one (the row's icon follows the file's extension).
  Only the header stays XML (`parseWorkspaceStatus`): the `STATUS` record names no selector. It stays a `query()`
  (`readPendingChanges`): it answers most workspaces in milliseconds and runs on every refresh, which a process would
  make 100–150 ms slower each time (about half a second more on Windows, where it needs a `cm shell` of its own for
  UTF-8: `printsInConsoleCodePage`); a workspace of a million changes holds one of its two sessions for 5–7 s, while
  the other keeps answering the workspace's other reads. As `cm ls`'s, its
  records come in UTF-8 on Windows only from a `cm shell` (`processCommand`, `printsInConsoleCodePage`).
- **`cm status` asks the server for its header**: unless `--compact` (or `--cset`, `--format`) is passed, `cm status`
  works out the workspace header even when it prints none, and asks the server for the head of the branch: about
  80 ms a command against Unity Cloud, in a warm `cm shell`, against about 20 ms with `--compact`. In machine-readable
  mode that header adds only `CONFLICT_MARKERS <path>` records, which nothing reads, so the records (`statusRecordsArgs`)
  and the machine-readable header (`machineReadableHeaderArgs`) pass `--compact` and stay local reads. The `--xml`
  header (`readStatusHeader`, the switcher's `readWorkspaceGlance`) can't: `--compact` prints the legacy text, and
  `--cset` drops the `<WkConfigName>` the selector is read from, so each costs that round trip.
- **XML remains** only where `--format` can't say it: the `cm status` header (`parseWorkspaceStatus`: a local read,
  under a KB) and `cm fileinfo` of one item or two (`parseItemDetails`, `removedItemSpec`), answers that stay small;
  and `cm history`, whose `--format` has no revision type, which tells text from binary from a directory, and a
  revision from a move or a removal (`itemHistoryArgs`: about 600 bytes a revision), read element by element as it
  arrives (`queryXmlElements`, `HISTORY_RECORD`). XML goes through `parseXml`.
- **The merge preview streams too**: `cm merge --machinereadable` ends its records with `--endlineseparator`
  (`MERGE_PREVIEW_RECORD_ARGS`), as `cm status` and `cm lock list` do, and in that mode prints nothing else.
- Never parse human-readable output when a machine format exists.
- **Records are read as they arrive**: new code reads a `--format` command with `cm.queryRecords(args, readRecord,
  options)` (or `executeRecords`), where `readRecord` builds a row (a branch, a changeset) from each record's fields, or
  `undefined` to leave it out. `RecordReader` takes stdout in byte chunks, from a pooled `cm shell` (`StreamOutput`)
  or a process (`runCmProcess`'s `reading`), and reads each record once its separator arrives, keeping only the one
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
- Values read as records arrive are slices of their own record, which V8 keeps alive while any slice lives. A cache
  that keeps them past the answer copies them as it keeps them, not every parser (`ownCopy`; `OwnCopies` for a value many entries repeat, like a repository spec):
  `BranchNamesCache`, `WorkspaceCopies`, `RepositoryTrees`.
- `cm find branch` leaves hidden branches out unless asked for (`hidden = 'true'`), and `cm find changeset` their
  changesets unless `ignorehidden = 'true'` (`branchExplorerFinds`; a list of one branch's changesets always asks for
  it, `changesetsService`); merges and labels come either way. No one `cm find branch` reads both: a `hidden`
  condition keeps only the hidden ones or leaves them out. So a list wanting both runs two finds, and one branch
  looked up by name (`branchesService.get`) asks for the hidden ones only when no visible branch has its name.
- Multi-line text (comments) goes through temp files (`-commentsfile`); `cm shell` cannot take quotes or newlines in arguments (`canRunInShell`).
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
  in `cm status` get forward slashes.
- On macOS `cm` reads names decomposed (NFD), as it reports them: local paths go to it so (`inCmPathForm`), or
  `cm checkin` of a composed `é.txt` finds no change. Branch names, queries and server paths are left as written.
- `cm checkin` first undoes the checkouts whose content is the loaded revision's; with nothing left it prints
  `NO_CHANGES_APPLIED` instead of `CHANGESET cs:N@…` and exits 0 (`readCheckinOutput`). When every change checked in was
  a checkout without edits (`isUnchangedCheckout`: `CO`, not `CO+CH`, in `cm status --iscochanged`), Changes says so in
  an info toast ("Nothing to check in"); with any other change in, no changeset is a failure (`expectedCheckinResult`).
- `cm checkin` and `cm shelveset create` take everything under each path they're given, and nothing makes them take a
  folder alone (paths read from stdin too): `--all` adds every change there, `--private` every private item. Given a
  path, they take along the checkouts of the folders above it, and with `--dependencies` their adds and private
  folders, nothing else in them; a moved or deleted folder must be given itself ("the change '/lib' must be selected
  too"), and so must all of a pending merge ("All merge changes must be checked in together"). So Changes gives cm as
  little as it takes (`checkinPathsOf`): never a checked-out folder holding something checked, `--private` only when a
  private item is checked (`CheckinRequest.addsPrivate`), and a private, added or moved folder alone when everything
  in it is checked: one path for a new project, however many files it holds. A checkout inside a writable xlink
  checks the xlink out: cm status lists it as a checked-out folder, and given, it took every private item inside the
  xlink. Shelving away gives cm those paths but undoes every change the shelve takes (`ShelveAwayRequest`).
- **What a check-in needs is checked with it**, in the list as the user clicks, never asked at the end: checking a change
  checks the private, added or moved folders holding it, all of a moved folder but its private items, the move away
  from where an added item now is, the moves out of a deleted folder, and all of a pending merge; unchecking one
  unchecks what can't go in without it (`neededWith`, `needingThem`, `pathsCheckedTogether`). Read back, the checks are
  made consistent (`consistentlyIncluded`): a new file in a folder left out stays out, one in a checked moved folder goes
  in; an item added where a move left, or a deleted folder, waits for its moves. What a shown change needs goes in even
  while the filter hides it, and the button counts it (lists.md "Filters"). A question is left only where a checked folder
  must be given and holds what isn't checked (`pulledIn`, "Also check in 2 changes inside lib?"): private items inside
  a moved folder once another private item is checked (only the user checks a private item), or an added or
  checked-out folder checked while some of its files aren't. The legacy client asks about
  dependencies in a dialog when Check in is pressed; that was dropped as breaking the flow at its last step. All of it
  is indexed once per read of the changes (`indexPending`), so a click looks up only the folders above what it touched,
  on lists of tens of thousands.

## Xlinks

Creating and editing xlinks is in features/xlinks.md; this section is how items under one are read.

Revision ids, item ids and changeset numbers are per repository, and an item under an xlink (nested ones too, and on
other servers) lives in the xlinked repository: `cm` looks a bare `revid:432251` up in the workspace's, where it is
another file or none. So a revision is never a bare id: `RevisionRef` (`shared/domain/revision.ts`) is an id with its
repository, set where `cm` names it, and every spec built from it names both (`spec.revision`: `revid:N@repo@server`,
`spec.itemAt`: `itemid:N#cs:M@repo`), as the official client carries each diff item's mount repository. The one
exception is `cm undelete`, which refuses any spec naming a repository and takes a bare id in the restore path's
(`undeleteArgs`): the app restores only items of the workspace's own repository.

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
  versions keep), and the workspace's `.plastic/plastic.selector`, which keeps it by design (the app doesn't read
  it). Everything else the app reads names it: the machine-readable status header, `cm wi`, `--format` outputs, `cm ls`, `cm fileinfo`, `cm diff`,
  `cm find`, `cm repository list`.
- **Where the app takes the name instead**, each from an output `cm` already names it in, never by mapping ids to names
  itself (`isOrganizationIdServer`, `main/cm/organizationIds.ts`, only tells an id apart):
  - The workspace's repository and server (`WorkspaceInfo`, `readWorkspaceStatus`): from
    `cm status --header --machinereadable` (`machineReadableHeaderArgs`), a local read with `--compact` ("`cm status`
    asks the server for its header")
    run only when the `--xml` header printed an id (`serverByName`). The header is shared for a few seconds
    (`WorkspaceHeaders`): the incoming changes read without a head take it from there (the renderer's
    `incomingChanges` without `at`: before updating, before catching up a check-in, and a partial workspace's check,
    `checkPartialIncoming`). Reads that need only what is loaded take
    `readWorkspaceLoad`, which has no server to misuse,
    and the header as printed (`parseWorkspaceStatus`) holds the id only as `printedServer`. The header's branch is
    read whichever form its `<WkConfigName>` prints (`selectorName`). The switcher's glance at another workspace
    (`readWorkspaceGlance`) reads only its branch and pending changes: its row already shows the repository.
  - A file's history (`withServerOf`): from the item's repository, as the `cm ls` the history runs anyway names it
    (`workspaceItemArgs`, `{repspec}`), or the revision the history starts from.
  - The home screen (`parseWorkspaceInfo`): `cm wi` names the organization's server from `cm`'s local cache of
    organizations, with no server call. Should it print the id instead, its head names no repository (`WorkspaceHead`'s
    `repository` null), so the recent workspaces' lookup asks `cm` (`repositoryOf`, the machine-readable header),
    as for a workspace `wi` can't tell: one query per workspace for the session (`workspaceRepositoryQuery`), two at a
    time across them in main (`workspaceRepositoryLookup`). Meanwhile, and for the workspaces past the recent ones,
    the row shows the repository's own name, which `wi` tells (`repositoryName`, `describedEntry`), and no server.
  Should `cm` not answer, the id stays rather than a guess.
- **What was saved under the id before**: nothing is migrated (that would be id-aware code to delete later). A
  shelve this app left on a Unity organization's workspace, recorded under the id, no longer matches the workspace's
  repository: it is offered as one another app left (adopted as foreign), its changelists are lost, and the folder
  where added files waited is no longer used to put them back. Review marks kept under the id's repository no longer
  show.
- **Its name can change**: an organization's owners can change its name (`acme` in `acme@unity`) in the Unity
  Dashboard. The old name stops working at once, with no redirect, and no other organization can ever take it; the
  organization's id stays. Workspaces keep working, as they name the organization by its id. So the app keeps what an
  organization keeps by its name and records its id with it (ARCHITECTURE.md "Settings survive renames"):
  `cm getconfig organization <org> --format={unityid}` (`organizationIdArgs`) prints the id (`1375943370549`; `-1` for
  an organization that isn't a Unity one) from what `cm` keeps on this machine, never asking a server, and fails for
  an organization `cm` hasn't signed in to here. `cm` learns a new name's id when it first signs in to it, and forgets
  the old name then. Its `--format` takes no `{tab}`: the command fails on it. It answers one organization a call, so
  `UnityOrganizationIds` asks it once per organization for the session: each session reads again the ids of the
  organizations that recorded one, and of those that keep something with none recorded (`organizationsToIdentify`);
  only when a recorded name no longer answers its id does it read the other organizations listed, to find it under
  its new name (`organizationsToSearch`). The profiles changing (a sign-in, a profile removed) makes it read them
  again (`OrganizationRenames.listed`, `UnityOrganizationIds.forget`), so a rename `cm` learns during a session is
  followed at once. A recorded organization whose name stops answering for another reason (the user left it) makes
  each session read the listed organizations with no id recorded, all local reads, until it keeps nothing: the
  sidebar lists only the profiles' organizations, so its favorite no longer shows there, and only its page, opened
  from a link to it, still offers the star that removes it. Never read `cm`'s own file mapping names to ids
  ("`cm` owns its files").
  `{unityid}` is the same number as the id form `<id>@cloud`; the app never builds that form from it.
- **Two kinds, and projects**: `cm` names a Unity organization `acme@unity` and an older cloud organization
  `acme@cloud` (`serverKind`, `shared/domain/organizations.ts`), which `cm profile list` already tells: the home
  sidebar lists one Unity account's at a time, by its switcher (docs/features/accounts.md "Home"), and groups them
  (`serverGroups`: Unity organizations, cloud organizations, servers), each kind with its icon
  (`ServerIcon`; `OrganizationIcon` is the building Unity's apps draw). Only a Unity organization has projects: a
  repository of type `Project`, which `cm repository list` leaves out unless asked with `--type=all`, and
  `{reptype}` tells apart (`repositoryListArgs`). Neither is in `cm`'s help: `cm` keeps `--type` for its own use and
  testing, so the app leans on an option `cm` doesn't promise. They come in the one command that lists the
  repositories, asked only of a Unity organization; a `cm` refusing `--type` or its `all` (`refusesTypeOption`) is
  asked again without it, and the list shows no projects. A project shows as the other clients draw it
  (`ProjectIcon`): a white cube on a tile in one of six colors (`--project-*`), picked by the code of its GUID's last
  character, the listing's `{repguid}` (`projectColor`), so it looks the same in every client; "All projects" is
  indigo (`ALL_PROJECTS_COLOR`). All workspaces colors a project only once its organization's list was read
  (`useReadProjects`, which asks nothing); until then its tile is neutral (`projectTileFill`). The cube and the
  organization's building are Phosphor's Cube and Buildings (Bold), drawn from `@phosphor-icons/core`'s own SVGs
  (`svgPathOf`), so its license ships in the third-party notices with the rest. A repository there is named after its
  project, the part before the first `/` (`Racing/Game`: `projectPartOf`, `projectOfRepository`, `nameInProject`,
  `nameWithProject`), which New repository builds from the project picked and Rename keeps (`repositoryRename`).
  The Repositories view filters by project (`ProjectFilter`, remembered per organization by the project's GUID, so a renamed project stays picked:
  `ServerSettings.homeProject`, `useHomeProject`; a name kept before moves to the GUID once a listing holds it,
  `movedHomeProject`) and
  All workspaces by organization and project (`PlaceFilter`, `placeOf`), from the repository each workspace already
  names: no command. Display names ("UnityTechnologies" for `unity@unity`) come only from Unity's web API, which the
  app doesn't call: it shows the organization's name as `cm` takes it.
- **Deleted repositories**: to a server's administrators, `cm repository list` also prints the deleted repositories
  the server still keeps, each named with `__DELETED__` before its name. They come in that same listing, so showing
  them costs no command: `repositoryListing.ts` sets them apart (`deletedRepositories`), under the name they had,
  marked `deleted` and with a spec naming them by GUID, which no two share. The Repositories view lists them only when
  the user asks (the Deleted toggle, offered only when the server lists some; `useDeletedRepositoriesStore`, kept
  across sessions), among the live ones by name (`repositoriesShown`), tagged Deleted, with Restore in place of their
  workspaces. Restore is one `cm repository undelete` by GUID, under the name it had, asking a new one only when a
  live repository took it (`repositoryRestore`, typed inside its Unity project as Rename does). The toggle's tooltip
  says Unity Cloud keeps them 7 days (`deletedRepositoriesTip`).
- **Kept so**: `fakeCmClient` fails a test whose code passes the id form to `cm` (`namesOrganizationById`; a profile's
  name is the id form itself, as `cm profile list` prints it, so `cm profile` is exempt), and development builds warn
  `[organization id]` in the console when a command does (`warnOnOrganizationIds`).
- Not done instead: reading `cm`'s own local table of organizations (a file in its config folder) duplicates what
  `cm` does and is the client's config, which the app doesn't keep reading (ARCHITECTURE.md "Own config"); keeping a table in the app
  (learned once per organization) was tried and dropped for the same duplication; `cm profile list`'s names cover
  only organizations with a profile of their own, not those signed in through `*@cloud` (docs/features/accounts.md
  "Known limit").
