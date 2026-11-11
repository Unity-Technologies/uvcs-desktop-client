# Incoming

Incoming (`features/incoming`) shows what the branch has that the workspace doesn't, what of it collides with local
changes, and the update that takes it. How the app learns there is something incoming (the incoming check, the chip,
its card) is ARCHITECTURE.md "Refresh"; this is the view.

## Changesets, then files

The left pane is the incoming changesets above the files, as every list of changed files shows them (ARCHITECTURE.md
"Lists of changed files"). The files are what Incoming is for:

- **The changesets' section** (`IncomingChangesetList`) shows "All incoming changes" and three changesets, then
  scrolls inside itself (`changesetListMaxHeight`, `CHANGESETS_SHOWN`), so the files always start right below. It
  closes, and stays closed across sessions (`useIncomingViewStore`); closed, its header sums the changesets up: "3
  changesets · Ana, Luis" (`changesetsSummary`). Each row is what the list of changesets read (comment, author, date):
  nothing is asked of `cm` per row, and no row counts its files. It holds the changesets read so far, 200 at a time
  (`useIncomingChangesetList`): while older ones remain it ends with "Show 200 more" (`IncomingShowMore`) and its
  counts say "200+" (ARCHITECTURE.md "Server budget").
- **"All incoming changes"**, where Incoming opens, lists the whole update: the diff from the loaded changeset to the
  head that Incoming reads anyway. The files that collide with local changes (changed on both sides, or changed
  locally and deleted or moved on the branch: `collidesWithLocal`) are a group of their own, "Conflicts with your
  changes", before "Changes to apply" (`incomingFileContent`), in the merge page's words: an update with conflicts is
  a merge. With no conflicts there are no groups. The line under the header says what updating does to the workspace:
  "1 conflict with your changes · 13 to apply", or "14 changes to apply · Your local changes stay as they are"
  (`incomingFilesSummary`). The "!" chip filters the conflicts ("Conflicts with your changes", `INCOMING_TONE_LABELS`).
- **A changeset** lists the files it changed and shows its details as History does (`ChangesetDetails` without its
  own files: they are the list). Its files are its diff, read once its row stays selected (`useSettledValue`) and kept
  for good: the very query its details panel elsewhere reads (`useDiffEntries`, one `cm diff cs:N`), so arrowing
  through changesets reads none of those it passes, and coming back to one reads nothing. ✕ in the files' header goes
  back to all of them.

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

A partial workspace loads no one changeset (docs/features/shelves-and-switching.md), so Incoming can't list the
changesets between the loaded one and the head: it lists the items the branch head would change in what the workspace
loaded, as `cm partial update` would bring them.

- **The check** (`checkPartialIncoming` in `useIncomingSummary`) reads the branch head (`readBranchHead`: one `cm find
  changeset … order by changesetid desc limit 1`) and, only when the head moved or an operation refreshed it, the
  comparison Incoming shows (`incomingChangesKey`); it counts items, never changesets (`PartialIncoming.itemCount`).
- **The comparison** (`readPartialIncomingItems`) is two listings and a status, whatever the head's distance: what the
  workspace loaded (`cm ls -R`, `LOADED_TREE_FORMAT`) with its local changes (`readPendingChanges`), then the head's
  version of the loaded folders (`cm ls <folders…> --tree=br:<branch>`, `HEAD_TREE_FORMAT`, batched by `fitsCommandLine`).
  `compareWithHead` pairs them by item id: changed, moved, removed or added, and a conflict where the item has local
  changes too. Xlinks and what they hold are left out (`loadedFolders`). A loaded folder the head no longer has fails
  its listing, though `cm` lists the rest: it's listed again without it (`listHead`, `notInTreePaths`). If the head
  moved it, its parent's listing shows it at its new path, which a next pass lists (`movedFolderPaths`); otherwise it
  reads as removed.
- **The view** (`PartialIncomingSession`) lists the items by group (`partialItemGroups`: conflicts first, then changed,
  moved, removed, added) with the line under each (`partialItemDetail`), and diffs the loaded revision against the
  head's (`partialItemDiffEntry`; a folder has none).
- **The chip** shows the 'items' state (`incomingChipState`) and its card the first items (`cardItems`,
  `PartialIncomingCard`).
- **Updating** (`updatePartialToIncoming`) runs `cm partial update`. An item changed locally keeps the local version
  until it is checked in, shelved or undone (`partialUpdateMessage`); the update bar offers Update only while some item
  doesn't conflict, and an update stopped by a conflict leads to Incoming (`explainUpdateConflicts`).

Sandbox: `scripts/sandboxes/partial-operations.sh`.
