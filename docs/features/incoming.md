# Incoming

Incoming (`features/incoming`) shows what the branch has that the workspace doesn't, what of it collides with local
changes, and the update that takes it. How the app learns there is something incoming (the incoming check, the chip,
its card) is ARCHITECTURE.md "Refresh"; this is the view.

## Changesets, then files

The left pane is the incoming changesets above the files, as every list of changed files shows them (ARCHITECTURE.md
"Lists of changed files"). The files are what Incoming is for:

- **The changesets** (`IncomingChangesetList`) are listed as a branch diff lists its own (`ChangesetFold`,
  `ChangesetStepList`: docs/features/diff.md "A branch's diff" says how its fold, rows, filter, steps, ⌥⇧↓ ⌥⇧↑, height
  and selection work): "All incoming changes" stands apart above them, the whole update, and folds them
  at its end ("Changesets ⌄"); under it, one line each, oldest on top. Why the same as a branch diff: both are a set of
  changesets read all together or one by one, and a header of its own over the list ("Changesets 3") was tried in both
  and read as a section's title, too quiet for what decides what the files are. Unlike a branch diff's, the list starts
  open, since what came in, and from whom, is what Incoming is for; folded, it stays folded across sessions
  (`useIncomingViewStore`), the row alone, as a branch diff's (how many came in, the view's header says; who, the
  list). Folding goes back to the whole update. Nor does it hide with one changeset, as a branch diff's
  does (`showsChangesetList`): that changeset's comment and author are the news. While Incoming checks, the row and the
  list's skeleton hold their places (`IncomingChangesetsReading`). Each row is what the list of changesets read
  (comment, author, date): nothing is asked of `cm` per row, and no row counts its files. It holds the changesets read
  so far, 200 at a time (`useIncomingChangesetList`), the newest first: while older ones remain, "Show 200 more"
  (`IncomingShowMore`) sits above the oldest shown, where the older ones it reads go (`showMoreBeforeKey`, a
  `DataTable` separator), and the counts say "200+" (ARCHITECTURE.md "Server budget"). Pressed from the keyboard, the
  selection lands on the newest of the page read, right above (`showMoreLanding`), so ↑ goes on back in time.
- **"All incoming changes"**, where Incoming opens, lists the whole update: the diff from the loaded changeset to the
  head that Incoming reads anyway. The files that collide with local changes (changed on both sides, or changed
  locally and deleted, moved or replaced on the branch, diff.md "A path replaced": `collidesWithLocal`) are a group of their own, "Conflicts with your
  changes", before "Changes to apply" (`incomingFileContent`), in the merge page's words: an update with conflicts is
  a merge. A file whose permissions alone changed on the branch has no content to merge, so it is never a conflict
  (diff.md "Only the permissions changed"). With no conflicts there are no groups. No header over the files
  names them, as in a branch diff: the row selected above does, the update bar says what updating does to the
  workspace (`updateBarMessage`), the filter counts the files and the groups their conflicts (`incomingFilesLabel`
  names them for screen readers). A header of their own, "All incoming changes" over "14 changes to apply · Your local
  changes stay as they are", tried, said again what the row and the bar above it said. The "!" chip filters the conflicts ("Conflicts with your changes", `INCOMING_TONE_LABELS`).
- **A changeset** lists the files it changed and shows its details as History does (`ChangesetDetails` without its
  own files: they are the list). Its files are its diff, read once its row stays selected (`useSettledValue`) and kept
  for good: the very query its details panel elsewhere reads (`useDiffEntries`, one `cm diff cs:N`), so arrowing
  through changesets reads none of those it passes, and coming back to one reads nothing. "All incoming changes", a
  click above, goes back to all of them.
- **Several changesets** (Shift or ⌘/Ctrl-click, Shift+↓/↑) list what they did together: their own range diff, from
  the oldest one's parent to the newest (`IncomingScope` `span`, `incomingScopeOf`; one `cm diff cs:A cs:B`, cached
  as immutable), opened on the first file
  (`firstIncomingFile`). Like a changeset's, those files are what the changesets did, without the conflict groups: only
  the whole update merges, and its files are the incoming changes' own read, which a range can't stand in for.

A file selected shows its diff: across the whole update, or what its changeset did. A file that conflicts shows the
conflict panel only in "All incoming changes", where conflicts are resolved: the update merges the whole of it. In a
changeset it shows what that changeset did, its conflict mark still on its row.

A Unity asset's `.meta` is listed with it (ARCHITECTURE.md "Lists of changed files", "A Unity asset with its `.meta`"), unless the meta collides with local
changes (`pairIncomingMetas`): a conflict is decided on its own, so it keeps its own row.

## Menus

A file's menu is a diff's (`diffEntryMenu`, on `changedFileMenu`: history, annotate, open or save the revision, Copy),
read from the scope's diff (`incomingDiffTarget`; built by `incomingFileMenu`). In "All incoming changes" the conflicts
selected add what the merge page's do (`conflictMenuEntries`, docs/features/merge.md): one of them "Resolve in <tool>"
(the file's own), "Resolve with ▸" any other this once, and "Open version ▸ Yours / Incoming / Base" (Yours is the workspace file), any "Keep yours" and "Keep incoming" ("Keep base" too when
each has one), for several at once too, and Start over once decided. A changeset's files add none: they are what it did. A changeset's
row has the changeset's menu (`changesetMenu`), the same as in History.

## Updating

The update bar (`UpdateBar`, `collisionMessages`) says what updating does and waits for every conflict to be decided;
conflicts resolve with the merge page's panel and runs (docs/features/merge.md). Keeping the base keeps the revision the
workspace had loaded: its text as read, or, for a binary, the file undoing the conflicting files writes back, copied
before updating (`saveBasesKept`; downloaded by `cm cat` only where undoing left no file). A base that can't be saved
stops the update and puts the local versions back. Sandbox: `scripts/sandboxes/incoming.sh`.

## A partial workspace

A partial workspace on a branch loads no one changeset (docs/features/shelves-and-switching.md), so Incoming can't list the
changesets between the loaded one and the head: it lists the items the branch head would change in what the workspace
loaded, as `cm partial update` would bring them.

- **The check** (`checkPartialIncoming` in `useIncomingSummary`) reads the branch head (`readBranchHead`: one `cm find
  changeset … order by changesetid desc limit 1`) and, only when the head moved or an operation refreshed it, the
  comparison Incoming shows (`incomingChangesKey`); it counts items, never changesets (`PartialIncoming.itemCount`).
- **The comparison** (`readPartialIncomingItems`) is two listings and a status, whatever the head's distance: what the
  workspace loaded (`cm ls -R`, `LOADED_TREE_FORMAT`) with its local changes (`readPendingChanges`), then the head's
  version of the loaded folders (`cm ls <folders…> --tree=br:<branch>`, `HEAD_TREE_FORMAT`, batched by `fitsCommandLine`).
  `compareWithHead` pairs them by item id: changed, moved, removed or added, and a conflict where the item has local
  changes too. An item is added only when it's new (a greater item id than every loaded item, in a later changeset)
  in a folder the workspace loaded whole: a folder that also holds an older item the workspace left out was loaded in
  part, and an update leaves out what's new in it too. Ids and changesets miss an old folder created after the
  workspace loaded something else (a folder Big, never loaded, reads as new), so a loaded folder the head changed
  that holds an item the workspace doesn't have (`changedFoldersWithUnloadedItems`) is listed as it was at its loaded
  changeset (`readChildrenWhenLoaded`: `cm ls <folders…> --tree=cs:<N>`, one per changeset, `treeListingArgs`): an
  item it held then existed, so the folder was loaded in part and nothing in it is added. Nor is anything added when
  that listing misses an item the workspace loaded in the folder: the folder kept an older revision than what it
  loaded (a partial workspace keeps its root at the one it was created with, changeset 0, empty), so the listing
  can't tell what it held (`unlistedIfWhole`).
  **Xlinks** are followed: the head lists the folders inside one through the workspace's branch, at their workspace
  paths, and its items belong to the xlinked repository. Their item ids say nothing about the workspace's (an xlink
  lists its target's root id, often the workspace root's own), so items are matched by id within their repository
  (`byScopedKey`, `enclosingXlink`), and each item inside an xlink names that repository (`PartialIncomingItem.repository`,
  `repositorySpec`), where its diff reads its revisions (`partialItemDiffEntry`). A folder inside an xlink was loaded
  at a changeset of the xlinked repository, so what it held then is listed there, at the path the xlink shows
  (`loadedListingOf`: `--tree=cs:<N>@<repository>`), and read back at its workspace path (`workspacePathOf`). `cm ls`
  lists an xlink as a folder (`dir`), never as an xlink, so both formats ask its `{name}`, which names its target
  (`parseXlinkName`), to tell it apart. A loaded folder the head no longer has fails its listing, though `cm` lists
  the rest: it's listed again without it (`listHead`, `notInTreePaths`). If the head moved it, its parent's listing
  shows it at its new path, which a next pass lists (`movedFolderPaths`, never into another repository); otherwise it
  reads as removed.
- **The view** (`PartialIncomingSession`) is the shared list of changed files (`FileTreeList`: a list or a tree,
  filtered, its folders closing), in the groups of `partialItemGroups` (conflicts first, then changed, moved, removed,
  added; `partialItemTreeGroups`). Each row ends with its letter (`partialItemStatus`, its `partialItemDetail` line as
  the tooltip), and a file selected diffs the loaded revision against the head's (`partialItemDiffEntry`; a folder has
  none). Up to date, it says so alone, as a workspace on a changeset does
  (`incomingViewState`'s `upToDate`).
- **The chip** shows the 'items' state (`incomingChipState`) and its card the first items (`cardItems`,
  `PartialIncomingCard`).
- **Choosing what to bring**: every item, folder and group has a checkbox, all checked to start (`partialItemChecked`,
  `partialGroupCheckState`, `withItemsChecked`; the view keeps the unchecked keys, `UncheckedItems`).
  `partialUpdateSelection` turns the checked items into the paths `cm partial update` takes: a changed or removed item
  by its loaded path, a moved one at its loaded path and in the folder it moves into, an added one through its parent
  folder (the workspace doesn't load it yet; a parent the head adds too climbs to the first folder the workspace has,
  `existingParentOf`), and only the outermost of nested paths. A folder brings everything changed under it, so the
  update may bring unchecked items too: the selection lists what it brings (`brought`), and names no path (`'all'`)
  when that is every item, or when an added or moved item lands at the top of the workspace.
- **Updating** (`updatePartialToIncoming`) runs `cm partial update`, with the selection's paths or none. An item
  changed locally keeps the local version until it is checked in, shelved or undone; the update bar says what updating
  brings, and which unchecked items a folder brings along (`partialUpdateMessage`), offers Update only while some item
  it brings doesn't conflict (`canUpdateSelection`), and an update stopped by a conflict leads to Incoming
  (`explainUpdateConflicts`). The update's count leaves out the conflicts it brings, which keep the local version
  (`conflictsIn`).

Sandbox: `scripts/sandboxes/partial-operations.sh`.
