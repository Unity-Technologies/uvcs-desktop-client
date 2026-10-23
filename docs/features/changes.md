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
  (`pickMoveMatch`) takes them from the pending changes the menu was built from, never a `cm status` of its own. While
  Changes hides private files (`showPrivate`), a deleted item has none to offer, and the dialog says where to show them.
- **How alike each file is** (`api.pendingChanges.moveSimilarities`, `main/workspace/moveSimilarity.ts`): as `cm`'s
  own move detection measures it (`FileChangesMatcher` and `FileDiff.GetChangesPerUnit` in `cm`'s sources), so a file
  the detection would pair at 30% reads 30% here, the same measure the official client's Search matches shows.
  - Which kind each file is: a deleted file's is `cm`'s own revision type (`txt`, `bin`: its file type rules and
    content set it), from one `cm ls` of every deleted path (`deletedFilesArgs`), with its loaded revision, repository
    and size. A new file has no revision, so its start tells (`looksBinary`: a NUL byte; UTF-16 text reads as binary).
    Changes can't tell either: `cm status --machinereadable` names no file's kind and no deleted file's size.
  - Text with text: 1 less the lines a line diff adds and removes (Myers' D) per line of the deleted file, whitespace
    and line ends ignored (`bIgnoreEolAndWhitespaces`), never below 0.
  - Binary with binary of the same extension, whatever its case: by size alone, 1 less how far the sizes are apart per
    byte of the deleted file (`bBinMatchingOnlySameExtension`). No binary file is read, on either side.
  - Any other pair `cm` doesn't pair (`notPairable`), and the dialog leaves it out; when that leaves none, it says so
    and hides the slider. A text file past `MAX_SCORED_TEXT_BYTES`, one that can't be read, or a pair whose diff would
    take more than `MAX_DIFF_WORK` isn't measured (`notMeasured`): its row shows a dash, last. What couldn't be read is
    warned in the main process's console (`[search matches]`); a failed measure says so in the dialog.
  - Folders aren't measured: `cm` measures a folder by its entries once their files are paired, which a pick by hand
    isn't. Their dialog has no slider.
  - What it costs: one `cm ls` of the deleted paths, then only the deleted text files under the cap read by revision
    (`revid:N@repo`), asked together so `RevisionCat` batches them per repository (an xlinked one apart): up to four in
    one quick `cm cat` after another, more in processes of their own. The new files are read from disk, 16 at a time,
    each path checked to be inside the workspace (`workspaceFileOf`): the window isn't trusted.
  - Measured once as the dialog opens: the slider, "Minimum similarity" (`PercentSlider`, as Settings' own), filters
    what was measured and runs nothing. Its query key has an area no refresh names (`moveSimilaritiesKey`), as the
    candidates are fixed: a file saved meanwhile measures nothing again. It starts at 80%, as the official client's
    does; a file the detection found too unlike shows once it's lowered (the empty list says so).
  - Unrelated files cost no diff: one side holding lines the other lacks bounds the changes from below
    (`changesAtLeast`), and past the deleted file's lines it reads 0. Every diff stops at the deleted file's lines and
    at `MAX_DIFF_WORK`, and the main process yields between pairs: a diff runs in one go, answering no other call.
- **What it records** (`api.pendingChanges.recordMove`): one `cm move <deleted> <new>` in a pooled shell. With the
  source missing from disk and the destination there, `cm` only records the move and keeps the new item's content
  (`CH+MV` for a changed file); nothing on disk changes. It refreshes the workspace's views and leaves the locks alone
  (`isAffectedByRecordedMove`). There is no unpairing: undoing the move is undoing any moved, changed item, which puts
  the deleted item back as it was and drops the new item with its content (the Undo dialog's backup shelve keeps it).
- `scripts/sandboxes/moves.sh` leaves a file and a folder of each side to pair (`src/lib/Rewritten.cs` and
  `src/app/Rewrote.cs`, `src/legacy` and `src/modern`). `scripts/sandboxes/move-matches.sh` leaves hundreds of new
  files at known similarities (each named for its percentage) to five deleted classes and two deleted binary files,
  and, the other way round, a new class and a new texture with dozens of deleted versions at known similarities
  (`src/Gameplay/WeaponSystem.cs`, `art/Textures/Weapon.png`), with unrelated files, a log too large to measure and a
  `.psd` that isn't pairable. Turn off "Detect moved and renamed files" in Settings › Pending changes first, or `cm`
  pairs the most alike on its own.
