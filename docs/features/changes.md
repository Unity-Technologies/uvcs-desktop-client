# Changes

What the Changes view does with pending changes that the rest of the app doesn't show. The list itself (rows, order,
List or Tree, groups) follows ARCHITECTURE.md "Lists of changed files" and "Item rows".

## Search matches: a move recorded by hand

`cm status` pairs an item deleted from disk with a private one as a local move only when their contents are alike
enough (Settings › Pending changes, "Similarity to consider a file moved": `moveSimilarityPercent`). A file renamed and
rewritten, or a folder renamed with its files changed, stays a deleted item and a private one, and checking them in
would lose the item's history. The detection can also pair the wrong items: the most alike, which the user knows
isn't the one. "Search matches…" in either one's menu pairs them by hand, with the detection on or off.

- **Who offers it** (`matchSideOf`, `features/pendingChanges/moveMatches.ts`): one change selected, with nothing
  else pending on it, a file or a folder (never a link or an xlink):
  - on the deleted side, an item deleted from disk outside `cm` (`locallyDeleted`);
  - on the new side, a private item, or a move the detection made (`isDetectedMove`: `locallyMoved`, its content
    changed or not), whose row is the item where it is now.

  Not an item deleted with `cm` (`deleted`): `cm move` can't find a revision for it ("Selector can't locate a
  revision"), and undoing the delete would put the file back on disk first. Not a new item inside a folder `cm` can't
  move into (`unversionedFolders`): a private folder, or one the detection moved, which is under version control only
  where it was ("… is a private directory. It can't be moved.").
- **What it offers** (`matchCandidates`): the other side of the same shape, files with files and folders with
  folders, as `cm move` of a file onto a folder moves it inside the folder. The likeliest first (`compareCandidates`):
  the same name (a move), then the same extension (a rename), then the closest folder, then path order. The dialog
  (`pickMoveMatch`) takes them from the pending changes the menu was built from, never a `cm status` of its own. While
  Changes hides private files (`showPrivate`), a deleted item has none to offer, and the dialog says where to show them.
  - Each detected move offers both its items: its new one to a deleted item, its deleted one, where it was
    (`oldPath`), to a new item. Each says what the detection paired it with ("Paired with Gun.cs", `pairingTag`), and
    a pick records that move instead: `cm move` takes it, and the item the detection had paired goes back to deleted
    or new. On a detected move's own dialog, its other item reads "Found by Changes": picking it records that move.
    The official client offers them too: its search runs the detection again, from scratch, around the item.
  - An item deleted inside a folder the detection moved isn't offered: `cm status` lists it at the folder's new path
    (`src/Archive/Old2.cs` for `src/Retired` → `src/Archive`), where nothing is loaded, so neither `cm ls` nor
    `cm move` finds it; the folder's move is the one to pick.
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
    (`revid:N@repo`), asked together so `RevisionCat` batches them per repository (an xlinked one apart): four at a
    time in a quick `cm cat`, one after another while at most `MAX_QUICK_BACKLOG` wait, in processes of their own past
    that. A path `cm ls` can't find fails it, the others listed all the same: they're listed again without the paths it
    named (`pathsNotFound`, matched on each OS's spelling of them), one more `cm ls`. Reading the records out of the
    failure instead was left out: what a failure keeps is the command log's text, its secrets hidden. The new files are
    read from disk, 16 at a time, each path checked to be inside the workspace (`workspaceFileOf`): the window isn't
    trusted.
  - Measured once as the dialog opens (`moveSimilaritiesQuery`): the slider, "Minimum similarity" (`PercentSlider`,
    as Settings' own), filters what was measured and runs nothing. The candidates are fixed, so no refresh reaches it:
    its key is an area no refresh scope names (`moveSimilaritiesKey`), and its `IMMUTABLE_QUERY` meta keeps it from the
    refreshes of the whole workspace (the Refresh button, a loaded changeset that moved). It starts at 80%, as the
    official client's does; a file the detection found too unlike shows once it's lowered (the empty list says so).
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
  (`src/Gameplay/WeaponSystem.cs`, `art/Textures/Weapon.png`), with unrelated files, a log too large to measure, a
  `.psd` that isn't pairable, and a pairing the detection gets wrong (`src/Legacy/Arsenal/Weapon.cs` paired with
  `Gun.cs` at 40% where it became `Rifle.cs` at 30%). With "Detect moved and renamed files" on, most of its deleted
  files are paired, and offered so; turn it off to see each on its own.
