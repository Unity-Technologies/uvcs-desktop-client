# Changes

What the Changes view does with pending changes that the rest of the app doesn't show. The list itself (rows, order,
List or Tree, groups) follows ARCHITECTURE.md "Lists of changed files" and "Item rows".

## Search matches: a move recorded by hand

`cm status` pairs an item deleted from disk with a private one as a local move only when their contents are alike
enough (Settings › Pending changes, "Similarity to consider a file moved": `moveSimilarityPercent`). A file renamed and
rewritten, or a folder renamed with its files changed, stays a deleted item and a private one, and checking them in
would lose the item's history. "Search matches…" in either one's menu pairs them by hand.

- **Who offers it** (`matchSideOf`, `features/pendingChanges/moveMatches.ts`): one change selected, deleted from disk
  outside `cm` (`locallyDeleted`) or private, with nothing else pending on it; a file or a folder, never a link or an
  xlink. Not an item deleted with `cm` (`deleted`): `cm move` can't find a revision for it ("Selector can't locate a
  revision"), and undoing the delete would put the file back on disk first. Not a private item inside a private
  folder: `cm move` refuses a destination whose folder isn't under version control.
- **What it offers** (`matchCandidates`): the other side of the same shape, files with files and folders with
  folders, as `cm move` of a file onto a folder moves it inside the folder. The likeliest first (`compareCandidates`):
  the same name (a move), then the same extension (a rename), then the closest folder, then path order. The dialog
  (`pickMoveMatch`) takes them from the pending changes the menu was built from: it asks `cm` nothing, not even a
  `cm status` once those are stale. While Changes hides
  private files (`showPrivate`), a deleted item has none to offer, and the dialog says where to show them.
- **What it records** (`api.pendingChanges.recordMove`): one `cm move <deleted> <new>` in a pooled shell. With the
  source missing from disk and the destination there, `cm` only records the move and keeps the new item's content
  (`CH+MV` for a changed file); nothing on disk changes. It refreshes the workspace's views and leaves the locks alone
  (`isAffectedByRecordedMove`). There is no unpairing: undoing the move is undoing any moved, changed item, which puts
  the deleted item back as it was and drops the new item with its content (the Undo dialog's backup shelve keeps it).
- `scripts/sandboxes/moves.sh` leaves a file and a folder of each side to pair (`src/lib/Rewritten.cs` and
  `src/app/Rewrote.cs`, `src/legacy` and `src/modern`).
