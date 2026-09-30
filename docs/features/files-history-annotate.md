# Files, history and annotate

The Files view, Browse repository, a file's history and annotations (`features/files`, `features/history`,
`features/annotate`).

## Files

The tree keeps its width (400 px at first; on a narrow window it gives way first, keeping 480 px for the
diff: `FILE_TREE_WIDTH`) and shows names only, with Modified once it's wider than 420 px: size, changeset, author
and comment are the selected item's, above its diff. A file shows one diff, the most telling for its status
(`itemComparison`), its toolbar saying what it compares: a pending change against the loaded revision as in Changes
("Your changes · vs cs:12": editable, discards), an up-to-date file's last change against its parent revision (the
listing names it, as History's `parentRevision` finds first: "Last change · cs:12 on /main by Ana · 2 days ago ·
comment"), a file with no revision whole against nothing ("New file", "Private file"). "Diff | Annotate" before it,
History's switch (`FileViewSwitch`; ⌘T in Files, the menu's Annotate; elsewhere Annotate opens the history; only
where there is something to annotate) shows the file annotated instead, with what is annotated in place of the
description (kept as the selection moves), its revision by id in its repository (`itemRevision`), or
as on disk while it has changes. A folder shows what it holds and its last change. The diff and `cm` lookups wait for
the selection to settle (`useSettledValue`, without remounting); revisions are cached immutable. F6 moves the keys
into the diff to scroll it, F6 or Esc back to the tree, which keeps `MAIN_FOCUS`. Every folder listing of the
workspace is one query (`directoryListingQuery`), shared by the tree, Go to file's actions, Paste and the name checks.
Browse repository shows its tree the same way, every item as its revision (with a filter of its open folders); a
changeset's tree never changes, so each of its folders is read once (`repositoryListingQuery`, immutable).

## Finding a file

One way to find a file, Go to file (⌘P anywhere; in Files also ⌘F or Ctrl+F, where the legacy
client finds files, and / from the tree: `filesGoToFile`; the header's search button): a fuzzy search (`fuzzyIndex`)
over every path on disk (`useWorkspacePaths`, read once, no `cm`), its results as the tree's rows. The one picked is
revealed in the tree, its folders expanded, and selected with its diff. The view has no find field of its own:
Go to file is the one way to find a file.

## History

A file's history (`features/history`) reads like the other lists beside a file: its revisions and moves
on the left (`HistoryList`, two lines a row: avatar and comment, then cs:N · branch · author · date; moves in
italics; the workspace's revision with the house, which `cm ls` reads from the workspace alongside `cm history`),
as wide as it was left (`detailsWidthStore`, `historyList`), and the selected one on the right: a header of its
changeset (`RevisionHeader`: comment, author · date · cs:N to copy · branch chip, Changeset diff, Show in Branch
Explorer, the row's menu behind "More actions") over one pane (`RevisionPane`) that shows it as a Diff against the revision it was
made from (`parentRevision`) or annotated, switched with "Diff | Annotate" (⇧⌘T), remembered (`revisionView`).
A history opens on the revision asked for (`select`: by changeset, or by revision id wherever the file was then),
else the newest (`initialHistoryRow`). Every "Annotate" but the Files view's opens it with `view: 'annotate'`
(`annotatedHistory`: Changes, the palette, a diff's file at the revision the diff shows, a row's "Annotate this
revision" in place), on the workspace's revision unless it names one; only a view picked in the page is remembered for the next histories.
Two selected revisions are compared with each other (`comparedRevisions`). The header follows the selection at once; the pane waits for
it to settle (`useSettledValue`), and every revision's contents and annotation are cached as immutable. The list
keeps the keyboard; ⌘E goes into the pane and Esc back.

## Annotate

`features/annotate` is shared (the history's pane and the Files view's) through `FileViewSwitch`
("Diff | Annotate", first in the diff's or the annotation's toolbar, taking the focus back when switching
replaces it, so ← → keep switching) and `AnnotationPane`
(`path`, the `revision` to annotate or the workspace's, a `leading` toolbar slot, and `history` where a history list
is beside it, with the file's revisions for walking back). Lines are read in blocks, runs of lines
from one changeset (`annotationBlocks`): the gutter labels each once (avatar, comment, changeset, date, "Annotate
before this change", beside a history), the label sticking to the top while the rest of its block is in view; an age strip in five
shades of the accent (`annotationAge`, ranked by date among the file's changesets, `--annotate-age-*`) runs down
each block, and a hairline across gutter and code marks where the next starts (`AnnotationRules`, drawn in the
same scrolled content, so nothing drifts). Hovering a block marks its row only; clicking its cell picks it, as ⌥↓ ⌥↑
do, and a faint tint fades over every line of its changeset when it has other blocks to find (clicking it again or
Esc lets go, before Esc leaves the pane). Its avatar and comment (the text, not the room after it) open a card
(`AnnotationCard`: the whole comment, Open changeset, Annotate before, Show in history, and a hint of how to find the
changeset's other blocks) and pick the block and pin it when clicked. Only the changeset number leads away (a link): beside a history it
(or Enter) selects the block's revision there, in Files it opens the file's history on that revision, as Show in
history does; the rest of the cell only picks. Walking back selects the revision before, with Back (the trail `useHistorySelection` keeps; picking in the list starts it over). ⌥↓ ⌥↑ walk the blocks (with ⇧, those of the same changeset), Space opens the card. The gutter, the rules
and Pierre's code render only the lines in view, at one pinned line height (`annotationLayout`); the code highlights as a
read-only diff does (`syntaxHighlighting`). A pinned revision's annotation is cached as immutable, the workspace's
follows its edits (`isImmutableAnnotation`).

## Moving items (cut and paste)

⌘X (Ctrl+X) cuts the selected items (`cutItemsStore`: only the outermost, never the root),
ghosted with a hint in the header; cutting again replaces them, and they stay cut across views until pasted, Esc
(never one a menu, dialog or field took) or another workspace. ⌘V moves them into the selected folder or the
selected file's (`pastePlan`, pure): never into themselves, a private folder (controlled items) or onto a name the
folder has in any case (those stay, after asking); items already there are left. `explorer.moveItems` runs it as one
operation, a `cm move` per controlled item and a rename on disk per private one, refusing any existing target
(`cm move` onto a folder moves inside it); then the moved items are selected, with Undo.
