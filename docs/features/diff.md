# Diffs

Everything a text or image diff does (`features/diff`, `features/review`), whichever view shows it. 3D models have
their own doc: `model-diff.md`.

A Unity asset's `.meta` is listed with it; the `.meta` button in the diff's toolbar shows the meta's diff
(ARCHITECTURE.md "Lists of changed files", "A Unity asset with its `.meta`").

A side of any diff that the workspace holds unchanged (the side before of the newest change of a file, the side after
of a changeset the workspace is on) is read from its disk, not downloaded: ARCHITECTURE.md "Server budget",
"Revisions on disk".

## The diff's header

Over a changeset's or a shelve's files (`TargetDiff`: from Changesets, Shelves, the Branch Explorer; in a branch diff's
"Changeset by changeset", over the diff's column, as "A branch's diff" says), the header says who, when and why (`ChangesetSummary`, `ShelveSummary`). A long comment is folded as a
details panel folds it (`FoldedComment`, through `SummaryComment`), but tighter: two lines of title and three of
description, then "Show more"; expanded, the description grows to at most 40% of the window and scrolls past that, so
the files and the diff stay in sight. A short comment shows whole, with no link. The header's description is keyed by
the target, so another changeset folds its own comment afresh. Indented lines in a comment (commands pasted in) read as
code, one per line (`parseMarkdown`).

## A branch's diff

A branch's diff shows what the branch brings to its parent, as a pull request does: `cm diff br:<branch>
--integration` diffs from the branch's common ancestor with its parent, so the changes it merged from its parent (or
a rebase) don't show (`branchEntries` in `main/services/diffService`). A branch already merged into its parent has
nothing pending, and neither has `/main`: `cm` answers empty, cheaply (it diffs the head against itself), and only then
is the whole branch asked for, so a finished branch still shows what it changed. Every other branch costs one command.

Why no toggle, like the official client's "Show pending to integrate": the whole diff, with what came from the parent,
is noise for anyone reading a branch, and the web code review and GitHub show only the clean one, with no option. Why
not decide first whether the branch received merges (as the official client does to show its button): that is the
same common-ancestor calculation `--integration` already makes inside its one command.

"Changeset by changeset" steps through the branch's changesets in a list stacked above the files of the one selected
(`BranchChangesetList`), one `cm find` for them all, so the diff keeps the width it has in "Whole branch" and the
files don't move as the mode switches. The page's header names the branch in both modes (`BranchDescription`); the
selected changeset's summary sits above its diff (`TargetDiff`'s `pageDescription`), since its height follows its
comment, and over the whole page it would move the lists being clicked at each step. Each changeset reads as History
reads a revision (`RecordRow`): its comment's first line across the list's width, then cs:N, author and date. Its
filter matches every word typed in a changeset's number, comment or author's name over the list already read
(`filterBranchChangesets`), with no command; it is not the view filter, so ⌘F stays with the files. A changeset the
filter hides stays selected and shown: its diff doesn't change under the user while they type, and the next step goes
on to the nearest changeset shown on that side (`changesetStep`). The arrows above the list, ⌥⇧↓ and ⌥⇧↑
(`nextChangeset`, `previousChangeset`, as Annotate steps through a changeset's blocks; ⌥↓ ⌥↑ are the changes'), step
from anywhere in the page but a text field, where they select text (`useShortcut`'s `whileTyping`). A branch with one
changeset shows no list (`showsChangesetList`): the header names it.

The list stays mounted as each changeset is stepped to, keeping its focus, scroll and filter: the files and the diff
are drawn by a `DiffBrowser` mounted again for each changeset, into the slots of a `DiffBrowserLayout` that stays
(`createPortal`). Why not key only what changes inside one component: the files and the diff share the browser's state
(the selection, the filter, the review), and the list sits in the files' column, so no single subtree holds just the
changeset's part.

Each row has the changeset's own menu (`changesetMenu`, as in the Changesets view), whose Copy ▸ Link shares the
changeset stepped to; the header's Copy link (⇧⌘C) stays the branch's, what the page is about. The list binds no list
keys, so its menu names none (`listKeysElsewhere`, ARCHITECTURE.md "Menus"): no ⌘C (`useCopyCommand`), as the view
under the page keeps its own, and offering the list's link would take the view's from ⇧⌘C once the page closes
(`useOfferSelectedObjectLink`).

### Up to a changeset

A changeset's menu offers "Open branch diff up to this changeset" (`branchDiffUpTo`, after "Open diff in new window"):
the branch's work from where it starts up to that changeset, so a branch that later merged its parent in (a "rebase")
can be read as it was before. It is a range diff (`branchDiffUpToPage`: `cm diff cs:<base> cs:<changeset>`, cached as
immutable), titled as the branch's ("Branch task up to changeset 12"). The base is where the branch starts
(`BranchStart`): the parent of its first changeset, as `xlinkBeforePoint` takes it. A merge from the parent doesn't move
it, and `cm diff br:<branch>` (without `--integration`) starts there too: on a local server, a branch that merged its
parent in still lists the parent's files that merge brought. What decides is `branchDiffBase`:

- **Hidden** on a branch that starts from no other (its first changeset has no parent: `/main`), and on the branch's
  first changeset, where the view knows the branch's start; it would be "Open diff" there. Where the start isn't known,
  only `/main` is told by its name: a top-level branch the app made from a changeset or a label ("Top-level branch" in
  New branch) has a base like any other. Another root branch, read when chosen, says it starts from no other branch.
- **Known with no command** where the view already read the branch's start (`ChangesetMenuContext.branchStartOf`): the
  Branch Explorer from its history (`branchStartInGraph`; not when the date range left out what precedes the branch's
  first changeset shown), a branch diff's "Changeset by changeset" from the whole branch it lists
  (`branchStartOfChangesets`).
- **Read when chosen** everywhere else (Changesets, Incoming, the top bar, the palette): one quick `cm find changeset
  "where ignorehidden = 'true' and branch = '<branch>' order by changesetid asc limit 1" --format={changesetid}{parent}`
  (`ChangesetsApi.branchStart`, `branchStartQuery`, which `xlinkBeforePoint` shares), never while the menu is built;
  `ignorehidden` reads a hidden branch's changesets, which `cm find` leaves out otherwise. Each choice reads it again:
  one quick command a click, so nothing is cached. Those lists can't tell a branch's first changeset, so
  they offer it there too; chosen there it opens that changeset's own changes, under the branch's title.

## Comparing two branches, changesets or labels

Two objects of a kind are compared from a selection of two (labels, changesets), or from one object's menu, "Compare
with another branch…", "…changeset…", "…label…" (the `compare` menu word), which asks for the other with a picker and
opens a range diff (`kind: 'range'`), the older side on the left: `cm diff <older> <newer>`, one command, cached as
immutable.

- **Branches** compare their heads, `cm diff cs:<head> cs:<head>` (`diffBranches`): `cm diff` takes no two branch
  specs (it reads the second as a path). The heads are the ones the branch lists read (`pickBranch` hands back the
  branch picked, its head too), so nothing is asked to resolve them; a head moved since that list was read is the
  list's staleness, as for a branch's own diff (`branchHead`). The header names each branch in words, its full name and
  head in the tooltip (the diff page's `sideNames`), as `cs:` specs alone wouldn't say which branch is which.
- **Changesets** are picked among the newest (`recentChangesetsQuery`: the palette's `cm find changeset ... limit
  2000`, one cache entry for both, never read again on focus), or any other by typing its number (`changesetChoices`):
  a repository's ~280k changesets are never listed. The rows match on what they show (number, the comment's first line,
  the branch's own name). A number typed is offered when the read can't rule it out, older than those read when the
  read stopped at its limit; any other shows as "No changeset N", which can't be picked, so
  no diff opens on a changeset that doesn't exist. While the list is read, or when it couldn't be (said in its
  place), a number typed can still be picked.

## An xlink in a diff

`cm diff` lists a changed xlink with no revision on either side, so there is no content to compare: selecting one
shows `XlinkDiff` instead of a file diff. It says whether the xlink is writable, the repository it points to, the
changeset it points to on each side (`cs:17309 → cs:17361`), and the diff's files under it, the ones `cm` lists for
what the xlinked repository changed; clicking one selects it in the list. An added or deleted xlink shows its one side,
and one whose target didn't change says what did (it became writable or read-only, or its other settings changed).
`xlinkDiffView` decides what shows.

Where it points is read once the selection settles on it (`useXlinkSides`, `DiffApi.xlinkSides`): one quick `cm ls`
of the xlink's folder at each side (`cm ls /<folder> --tree=<point>`, which names the xlink after its target,
`parseXlinkName`), after one `cm find` when the side is a changeset's parent. A changeset's sides are its parent and
itself; a range's, its two points; a branch's, where it started (the parent of its first changeset) and its head. A
branch's diff starts at its common ancestor with its parent (`--integration`), which no read names cheaply: the
branch's start is the same point unless the branch merged from its parent, so the side is called "Where the branch
started", not "Before". A shelve's tree and a label's can't be listed (`listsTree`), so there the panel shows only the
files; `cm ls` reaches through xlinks, so an xlink under another is read as any other. A changeset's or a range's answer is cached as immutable; a branch's is
re-read as the server lists are (`SLOW_CHANGING_QUERY`).

Not shown: the xlink's branch expansion rules, which only `cm xlink --show` prints, and only for a workspace's own
xlink. The official client shows the xlink as text in a file diff, rules included; its target changesets are what a
reader of the diff needs.

## A purged version

A purge (`cm purge`, where the server allows it) removes old revisions' content for good; their changesets, paths and
history stay. `cm cat` of one fails with `Can't retrieve the content of the file '<file>' because the revision (id:N)
was purged …`, naming the file it was to write, never the spec (`isPurgedRevisionError`, `purgedTargetOf`). In a batch
it writes the other revisions and prints that line for each purged one, so `explainCatFailure` tells them apart by
their file, with no command more (ARCHITECTURE.md "Server budget"). `ContentApi.read` answers such a version as
`PURGED_CONTENT` (`FileContent.purged`), not as a failure: it never comes back, so it is cached as any revision.

- A diff shows a purged version as a missing one (an added or deleted file's): the other version alone, under a line
  saying which was purged (`purgedVersionsOf`, `purgedNotice`). Both purged, it says so ("Content purged"). A binary's
  sizes say "Purged" for it (`sizeChange`).
- The merge page never takes a purged version as an empty text, which would merge the file as emptied: the file reads
  as failed, saying why (`loadConflict`, `UNMERGEABLE_PURGED_MESSAGE`). It is decided where the merge takes the
  versions, not in their query, which the diff of a version shares.
- Pending changes whose loaded revision was purged can't be discarded (`canDiscardChanges`): going back to a text that
  isn't there would empty the file. Nor does saving one ever tell it matches its loaded revision (`savedAsBase`).
- A model's companion (a `.bin`, a `.mtl`) whose content was purged reads as not there (`readBytes`' null).
- Open and Save as of one fail saying it was purged (`saveVersion`, `PURGED_VERSION_MESSAGE`), not with `cm`'s line
  naming a temp file.
- Only a line naming the read's own file tells it was purged (`isPurgedRevisionError(error, target)`): a batch's
  failure passed on whole to each of its reads may name another's. `cm` names the file as it was given, never resolved or shortened.
- Only English output is recognized, as elsewhere; in another language the diff says it couldn't load the file.

`scripts/sandboxes/purged.sh` builds a diff with each case (the later version purged, both, the earlier one) and a
branch whose merge has a purged base.

## Reverting a file

A file a changeset's diff changed (the diff page, a details panel's changed files: a changeset's, a label's, a code
review's of a changeset) or a range of changesets changed has "Revert file to before this change…" in its menu
(`revertFromDiffEntry`): the file goes back to the diff's older side as a pending change, `history.revertTo` (`cm
revert <file>#cs:N`, a Unity asset's `.meta` in the same command) with History's confirmation, which names the changeset it goes back to and, for a changeset's
diff, the one it undoes ("Revert src/a.ts to changeset 37, before changeset 42?", `revertItemTo`'s `undoing`). It is
the native client's "Revert changes" on a diff: undoing what the diff did to the file is what a diff is looked at for,
and History already reverts to the newer side ("Revert file to this revision…"). Like the native one, it reverts the
content whole: changes made to the file after the diff go too, which the confirmation's changeset number tells.

- The older side is a changeset: a changeset's parent (`olderSideOf`, read on click by `readChangeset` from what the
  diff's header or a list already read, else one `cm find`), a range's first changeset. A branch's diff starts at its
  common ancestor with its parent, which nothing read names, a label range at a label, and a shelve at no changeset of
  its own: none of them offers it.
- Only one file whose content changed, in place or moved too, of the workspace's repository (`canRevertFromDiff`):
  `cm revert` finds the item by its id and takes its content back, keeping its name, so a pure move has nothing to
  revert; an added file had no older version, a deleted one comes back otherwise ("Restoring deleted items"), a folder or an xlink has no content to
  take back, and an xlinked repository's changesets aren't the diff's.
- Incoming offers none: its changes aren't in the workspace yet (`diffEntryMenu` without `workspaceRepository`).
- `cm revert` finds the file where the diff names it, in the workspace: a file moved or deleted since fails with
  `cm`'s message, and one with pending changes too ("must be checked in").
- It refreshes what a checkout does (`isAffectedByPendingChangeEdit`).

## Editing in the diff

A workspace file shown against its own past (loaded revision, reviewed copy, or nothing for an
added file: `canEditInPlace`) is typed into directly on its modified side, like the official client; every other diff
(history, merges, conflicts) is read-only, with no caret. Pierre's editor holds the text and its undo (⌘Z while typing);
`useFileBuffer` keeps what the disk doesn't have yet: Discard and Save (⌘S) show in the header as soon as there is some.
Without unsaved edits the diff follows the disk; with some it holds still and says the file changed on disk. Saving
reads back the text the editor holds, so the diff stays as it is (`heldModifiedText`): showing it anew would end the
editor's session, dropping the caret and undo and highlighting the file again on the main thread (1.6 s for
2 x 190 KB of TypeScript). Leaving a diff typed into (another file selected) doesn't highlight it on the way out:
Pierre refreshes a diff's colors as its edit session ends, on the main thread for our diffs, which have no
`cacheKey` (1.6 s for 2 x 190 KB); `pierreSessionEndRefresh` runs that a task later, and only for a diff still
shown. A file with
no lines to show (no content changes, empty, only ignored differences) is typed into whole, under a note (kept while
it's typed into). ⌘E puts the
caret in the text and Esc leaves it for the file list; keys the editor handles never reach the app's shortcuts. Read and
edit look the same: the editor is on as soon as the diff has its colors, so nothing in the diff moves when typing
starts. Each pane of code
scrolls sideways on its own and its bar would sit at the end of the file, shown only while hovered, so `PaneScrollbars`
keeps one per pane at the bottom of the view, wherever Pierre shows code (diffs, the whole-file editor, merge
resolution, moved code, Annotate; `codeScrollsSideways.test.ts`). The view itself never scrolls sideways
(`PaneScrollbars.module.css`): only its panes do, so a resize, which takes a few frames to measure the bars again,
never shows a second bar under them. The panes' own bars are hidden through Pierre's
`--diffs-scrollbar-gutter-override` (`paneScrollbarsCss`), so the code ends with the gap it starts with (8 px), and
while the bars show it leaves room for them under its last line: scrolled to the end, the last line sits whole above
them, and the view's scroll padding keeps the caret typing past the bottom clear of them too. Every text diff, and the whole-file editor, renders only the
lines in view (Pierre's `Virtualizer` on the diff's scrolling element): what's drawn again (a line added, a typing
pause's word marks, a theme switch) costs those lines, not the file's. With every line of a 190 KB file shown, the
typing pause's redraw took 0.45 s before; it's now under a frame. A file's language comes from its path
(`lib/syntaxLanguage`, for diffs, annotations and merges alike): its whole name first (Dockerfile, Cargo.lock,
.gitignore), then its longest extension (.gradle.kts before .kts), from tables of the grammars Pierre bundles (.NET
projects are XML, Unity's assets YAML, its shaders HLSL), then Pierre's own guess; a test checks every one is in
Pierre's bundle. Pierre 1.6's WebAssembly highlighter (`preferredHighlighter: 'highlights'`, 50 to 150 times
faster than Shiki here) isn't used yet: the editor drops the added side's word marks with it
(pierrecomputer/pierre#1210), it shows ShaderLab and the ignore lists as plain text with no fallback to Shiki, and the
page's Content-Security-Policy would need `'wasm-unsafe-eval'`. Shiki reads whole files at once, never just the
lines in view, so `syntaxHighlighting` picks by size (both versions together), at 1.5 to 4.5 ms a KB on the main
thread: a diff up to 20 KB highlights there before it shows (about 0.1 s); up to 4 MB (400 KB if it's typed into) it
renders only the lines in view, shows as plain text at once and takes its colors from Pierre's worker
(`useHighlightWorkers`: 0.2 s for 2 x 16 KB, 1.2 s for 2 x 156 KB, 1.7 s for 2 x 190 KB of TypeScript, 12 s for
2 x 1.6 MB; one worker, in the app's theme only, see Memory; started from `pierreHighlightWorker`, see Pierre
workarounds), in the editor's markup (`useTokenTransformer`). A diff
typed into gets its editor once the worker's colors are in (`attachesEditor`, `isReadyToEdit`): Pierre's edit session
reuses them, where an editor attached earlier makes Pierre highlight the whole diff on the main thread (1.6 to 1.8 s
for 2 x 190 KB of TypeScript, the app frozen). A click in the text (or ⌘E) before then waits for them, keeping what's
typed meanwhile and typing it at the click once the editor is attached (`focusAt`, `typeWhileAttaching`); only a
worker that failed (`MAX_WAIT_FOR_COLORS_MS`) attaches it anyway. That main-thread fallback is why a diff typed into
goes to the worker only up to 400 KB (`MAX_HIGHLIGHTED_CHARS`). Anything bigger is plain text and renders only the
lines in view too (Pierre renders a plain text diff whole at every render: `pierrePlainTextRender` keeps it), with a
quiet "Large file" in the header (its tooltip says why and past what size: `plainTextThresholdLabel`, 400 KB editable, 4 MB read-only); such a diff is the "text" language (`highlightedLanguage`),
or the editor would color the lines typed into it. Plain text marks the words that changed like any diff
(`pierrePlainTextWordDiffs`): Pierre marks none in a plain text diff of more than 1,000 lines, but words are diffed
only for pairs of changed lines, whatever the file's length, so the bound is those pairs instead
(`MAX_WORD_DIFFED_LINE_PAIRS`, 1,000: as many as Pierre already diffs for any diff of 1,000 lines). Past 1 MB (both versions), the text typed into is diffed again
once typing pauses, not at every keystroke (`diffsEveryKeystroke`): the +N −M and the lines discards act on follow
then, as Pierre's recoloring does; nothing is discarded until they do.
While typing, Pierre rebuilds only the rows typed into, from the editor's tokens, without word marks, and keeps the
original's rows with the marks they had; so once typing pauses (`TYPING_PAUSE_MS`; never while an input method
composes text, which a redraw would end), the rows Pierre keeps are marked anew on both sides
(`useWordMarksRefresh`, `pierreWordMarks`): each pair of changed lines gets the marks Pierre would give it
(`lineWordMarks`), every other row loses its own, only the rows whose marks differ are rebuilt from their colored
tokens (`markedRow`), and the diff is drawn again from them. Nothing is highlighted again, so a file of any size
gets its marks, up to `MAX_WORD_DIFFED_LINE_PAIRS` changed pairs (past it they come with the save). Drawing again
costs what Pierre's own redraw after Enter costs, for the rows in view: under a frame. A highlighted diff whose rows
already have the right marks isn't drawn again. The redraw hands the editor its rows back, so the caret, selection
and undo stay. Re-highlighting the whole diff instead was tried and rejected: 2 ms a KB at every pause, 0.7 s for 2 x 156 KB. Pierre has no row-level way to do it:
`updateRenderCache` rebuilds only the addition rows it's handed, without marks, and the refreshes after a keystroke
(`refreshSplitDiffView`) only recolor rows.
Every diff of two versions follows Split/Unified, one from or to an empty version (an empty base, a file emptied)
too: `shownDiff` keeps both sides where Pierre would show a new or deleted file in one column, and the empty side is
hatched like any added lines. An item with one version only (added, private, deleted; a revision that created the
file) shows it alone, in one column. "No newline at end of file" shows only where the final line break is what changed (`noNewlineMarker`); a diff
typed into keeps the marker rows, hidden, since Pierre recolors the rows it rendered only while there are as many as
the diff has. The editor's line for the caret after the last line break (the one line of an empty text) looks like
an unchanged empty line (`caretLineCss`): Pierre shows it as added after a change that removes more than it adds.

## Leaving unsaved edits

`app/navigation/leaveGuard` lets unsaved edits guard the way out. Selecting another file
(`selectAfterLeaving`), another view (`goToView`) or checking in asks Save / Don't save / Cancel first; a diff that goes
away without asking saves its edits, so work is never lost. Closing the window, quitting (⌘Q, whichever window has
focus) or reloading asks the same (`guardUnloading`): the page holds its `beforeunload` back, the main process brings
its window forward and sends `leaveRequested` (`main/window/leaveRequests`), and once the edits are saved or dropped
`windows.continueLeaving` closes the window, quits or reloads; Cancel keeps the window and stops the quit.

## Discarding changes

A workspace file's diff against its loaded revision (or reviewed copy) discards changes from
its gutter (`features/diff/viewer/useBlockDiscard`): hovering a changed line offers that one line (− removes an added
line, ↶ restores a removed one) and a chip at the right end of the change's top edge (in the pane of its new code, clear
of the line numbers and of the start of the line above) the whole change. Line numbers pick lines (click,
Shift+click, drag, shown as they're picked; only changed lines' numbers react) and the chip then acts on them
("Restore 3 lines", ⌥⌘Z: `useLinePick`); picked lines show no line button of their own, and Esc or a click elsewhere
drops the pick. Only lines the diff has as changed offer a button, as Pierre recolors lines a moment after typing stops and a
hovered line may stop being one as the text changes under the pointer. After a discard the line that slides under
the still pointer is hovered anew, so clicking on removes the lines
below one by one (a click within 150 ms of the last is the rest of a double click: `useLineDiscarding`). While typing, the chip stays
hidden until typing pauses. The diff's focus ring is for the keyboard only (`usePointerFocusMark`: clicks mark what
they focus, since Chromium shows `:focus-visible` once any key, even Shift, is pressed). The new text is computed in
the renderer (`discardLines`). Without unsaved edits it's shown at once and written, and each file keeps an undo
stack for the session, kept through a visit to another workspace (⌘Z in the diff: `DiscardHistory`; past
`MAX_DISCARD_HISTORY_CHARS` of text the oldest of any file go, as each keeps the whole file before and after); with
some, it's one more edit in the editor, unsaved, and ⌘Z takes it back like typing (`diffDiscards`).

## Restoring deleted items

An item a diff shows deleted (a changeset's, branch's, shelve's or range's; a file or a folder) comes back from its
menu, in the diff page and a details panel's changed files, as a pending change: "Restore file", "Restore folder" or
"Restore N items" where it was, and for one item "Restore to…" any path in the workspace, typed with `/` (or `\`
on Windows: `typedRestorePath`) (`restoreMenuEntries`, `restoreDeleted`). `cm undelete <revid:N> <path>` writes the revision the deletion removed (the entry's
`baseRevisionId`) and records it as copied; a folder comes back with everything it held then. It is offered only when
every selected item was deleted, in the workspace's own repository, and none is an xlink (`deletedItemRestores`):
`cm` restores no xlink nor xlinked item, and finds a bare id only there (`undeleteArgs`). Incoming offers none: what
it deletes is still in the workspace (`diffEntryMenu` without `workspaceRepository`).

- `cm diff` lists a deleted folder alone, but where a diff lists it with its files the list shows only the files
  (`listedEntries`): a file of a deleted folder comes back with the outermost folder the diff deleted ("Restore folder
  docs"), as `cm` restores nothing into a folder that's gone, and a folder row's files are one restore of it
  (`deletedItemRestores`, given every entry of the diff: `diffEntryMenu`'s `diffEntries`).
- `cm` takes one item a command, so several are one operation running one each (`restoreDeletedItems` in main),
  which stops between two. A folder row of a tree selects every deleted file under it, so past
  `MAX_RESTORED_WITHOUT_ASKING` (20) items it asks first: each is a process and a round trip to the server.
  `undelete` counts as a transfer (`runsLong`): a folder downloads all it held, so it runs as a process, never
  holding a pooled shell.
- Every place is checked on disk before any `cm`, and nothing is restored if one fails: `cm` refuses a path that holds
  an item ("The restore path should not exist"), but into a folder that's gone it writes the files and then fails,
  leaving them private. Main also refuses a revision of another repository than the workspace's (read from the status header the window's info
  shares, `headers.status`), whatever the renderer asked: the bare id would name another item there.
- `cm`'s own refusals read in the app's words (`undeleteRefusal`): an item the workspace still loads ("The item 35
  is already loaded on tree on path '/src/a.cs'" becomes "The workspace already has this item, at src/a.cs"), a folder
  holding an xlink, a place taken after the check. Only English output is recognized, on purpose: `cm` in another
  language shows its own words, as any other failure does.
- A refusal crosses as data, never as text to match (`RestoreOutcome`: how many came back, and the `RestoreRefusal`'s
  kind, path and words), stopping the rest: the error toast says what came back before it ("Restored 2 of 5 items")
  and offers what helps (`refusalAction`): "Restore to…" for an item whose place is taken or whose folder is gone,
  starting from where it was, then going on with the items the refusal left behind; and "Show in Files" where the
  workspace already has it. Stopped, the info toast says what came back too, or only "Stopped" when nothing did. Any other failure fails the operation, as `cm` tells it.
- Not handled: "Restore to…" a path under an xlink. `cm` looks the bare id up in the xlinked repository there, where
  it may name another item or none; knowing where xlinks are would take a `cm` read of its own.
- `cm undelete` takes the workspace's path as `cm` names it: given a link to it (`/tmp/…` for `/private/tmp/…` on
  macOS) it writes the files, then fails with "Item path not in workspace", leaving them private. The app's workspace
  paths come from `cm`, so only a hand-typed command meets it.
- The official client asks to confirm first; nothing is lost here (the item comes back as a change to undo or check
  in), so it asks only past `MAX_RESTORED_WITHOUT_ASKING` items, for the time they take.

`scripts/sandboxes/deletes.sh` builds changesets that delete a file, a folder, an accented name, a path a new file
took, and (cs:5) 25 files one by one, more than are restored without asking.

## Keeping the place

Switching how a text diff lays its lines out (unchanged lines collapsed or all shown, Split or Unified, wrapped or
not) keeps the line at the top of the view where its row stood, so the code being read doesn't move (`useKeptPlace`,
`keptPlace`). The line is read from the screen as the preference changes, before the diff draws again (`rowAtTopOf`,
looking down the modified side and, across from a removed block, the original's: `topProbePoints`), and put back once
Pierre laid the lines out anew, rendered or not (`scrollToLine`, `pierreLineBox`); a line that collapsing hides puts
the bar standing for it there, and a row partly scrolled past stays as much scrolled past, a wrapped line unwrapped
included (`keptOffset`). Only a switch that changes what's drawn keeps it (`relaysOut`, from the layout as drawn,
`linesLayoutOf`): not wrapping a file a long line already wraps, collapsing one a link's lines unfold or a file typed
into whole, nor Split | Unified for a version shown alone.

## Moving through changes

Every text diff of two versions steps through its changes (`useChangeNavigation`: the regions of the one `lineDiff`, so
they follow what's typed) with ⌥↓ ⌥↑, F7 ⇧F7 (the editor keeps ⌥↓ ⌥↑ to move lines while typing) and the header's arrows
(see "The arrows never move" below), from the diff or the list beside it; the first move goes from the top of the view.
The change comes a few rows from the top unless it's all in view (`scrollToChange`: a big diff not rendered there yet is
scrolled to where Pierre lays it out, `pierreLinePosition`; collapsed lines never hide one, as changes are always in the
hunks shown), lights up for a moment and, where discards are, is picked for ⌥⌘Z. Past the last or first change, a diff
beside a list of files (a diff page, Changes, Incoming: `FileStepsContext`) goes on to the next file's first change or
the previous file's last, asking about unsaved edits first. Incoming's diffs and conflicting files step through
different files but share where a step arrives (`usePendingArrival`), so ↓ past a diff's last change into a conflicting
file lands on its first conflict, and no arrival is left waiting for a file opened later. A diff opened any other way
(picked in a list, from a link, on a page) opens with its first change in view, a few rows from the top unless it starts
in view already (a collapsed diff's first hunk, whose bar stays above it: `ChangeScroll`), not lit nor counted until the
first move goes to it (`openingStep`, `ChangeView.show`); one opened on a link's lines stays on them. It opens so once,
as the diff first shows: changes typed or read later leave the view where it is. A version shown alone (an added or
deleted file) is one change; a file with none to step through (an image, a model, a binary, identical versions) keeps
the arrows, which go from file to file ("Previous file", "Next file", no label), so stepping through the list never
stops there. It steps through the files as the list shows them, never on to a folder (private, deleted or moved), which
has no diff (`fileRowKeys`, Changes' too), though a folder's `.meta` diff shown in Changes steps on from the folder's
place (`FileStepsOptions.rowOrder`); in a tree, those in a closed folder are skipped. With only folders pending, Changes
selects the first of them (`firstChangeKeyOf`). The list itself, its order, layout and groups, are every list of changed
files' (ARCHITECTURE.md "Lists of changed files"); a folder or a status group selected in it shows how many changes it
holds instead of a diff. The stepping itself (the position, the keys, the arrival from a file beside it) is
`useStepNavigation`, given the steps and a `StepView`: `useChangeNavigation` is it over a diff's change regions, and the
merge page steps through conflicts with it (merge.md "Stepping through conflicts").

### The arrows never move

People click ↓ many times in a row through a changeset, past each file's last change into the next file, so the arrow
must never move under the pointer. The arrows are the header's last slot, side by side at its right edge, in every
diff's header alike (`DiffViewerFrame`'s `navigator`): text, image, model, binary, identical, loading, an error, an
xlink. Right before them, with no room reserved, the label has one form, "3 of 12", and only while a change is current
(`positionLabel`); otherwise it is empty, as the line counts and the diff itself (identical, binary) already say how
many there are, and the arrows' tips carry the count ("Next change · 12 in this file"). A count before the first step
("12 changes") and "No changes" are left out on purpose: three forms of one label read as noise, and the room they
needed, reserved, left "1 of 1" floating in a gap. It grows leftward, in tabular figures; then the Expand button and
the view's controls. What they show is `changeNavigatorView`, decided by the view, never by the file shown: beside a
list of files always (disabled at its ends rather than gone); with no list, on every diff a `FileDiffViewer` draws
(History, Files, Browse repository, the merge page's previews of a change and its directory conflicts' comparisons:
disabled where there is nothing to step through, an image, a binary), and on none of a merge page's merged result,
whose conflict arrows step instead (`stepsThroughChanges` off).

**Whose arrows.** The arrows are one element for as long as the view shows diffs: the header belongs to
`SteppedDiffFrame`, which `FileDiffViewer` draws around every state of a file (loading, failed, loaded), and the loaded
diff (`LoadedFileDiff`, mounted anew per file) draws its controls into it (`createPortal`) and hands it its navigation
as it renders (`DiffFrameHost.publish`), saying whose it is (its versions' `diffContentsKey`). `headerArrows` decides
from the selected file's key and how its read stands: with that file's diff published, its navigation, label and keys;
otherwise (the file being read, the previous file's diff still on screen; read fast, its diff mounted while the previous
one's navigation is still the one published, as publishing follows the render; its viewer's code loading) the header's
own, with no label (never the previous file's "3 of 3" beside the new title), both arrows enabled with a neutral tip
(`ArrowGoal` `'queued'`); where the file couldn't be read, the header's own going from file to file.

**Where a press goes.** One router decides it for every navigation (`routePress`, `pressRouting.ts`): a diff's, a
conflicts view's, the header's own, an xlink's (`FileOnlyNavigator`), and the burst tests walk it too. It knows what
holds the press (`PressHolder`: a view that opens at its arrival, a header waiting for the selected file's diff, or one
with no steps of its own, a file that couldn't be read or an xlink) and the file the list is ahead on. A press is kept,
tagged with a file's path, for the file a step went to while the view shown is still the previous one's
(`FileSteps.steppingTo`, also before the list redrew, `PendingArrival.from`), or the list is on while Changes' diff
settles after a click (`FileSteps.settlingOn`, from the host's own two values, the change selected and the one diffed);
for a view until it opened at its arrival; for the selected file's diff while the header waits for it. Otherwise it
steps, and a press that would be kept leaves the arrow enabled (`pressGoal`), so no click is lost to an arrow disabled
by the list's end.

**Where kept presses wait.** In one queue (`StepQueue`): the list's (`FileSteps.kept`, which the lists of one view share
with their pending arrival, so a step from an Incoming diff into a conflicting file hands the conflict's view the
presses left), else the frame's own. A step from a file takes the presses still left for it along to the next file, in
order (`applyPress`), so a burst across a one-change file, an image, an unreadable file or an xlink loses none. A step
is recorded only once the list selects (`FileStepsOptions.select`'s `selected`): kept unsaved edits (Cancel) leave
nothing in flight, and the arrows go on in the file shown.

**When they're taken.** `takesKept`: the selected file's diff once it opened at its arrival, not a previous one still on
screen; a navigation with no steps (an unreadable file, an xlink) at once, replaying them as steps from file to file;
never a header waiting for the diff. A press that moves the view is the last until the render it brings; one that does
nothing (past the last change of the last file) brings no render, so the next is taken at once (`drainKept`). A diff
that will never have changes to step through (`stepsCanCome`: anything but a text diff, or a file typed into as a diff)
opens at once. So ↓ onto file B and ↓ again while B loads, or just after, ends on B's 2nd change, and ↓↓↓ on its 3rd.

**When they're dropped.** Only when the selection leaves their file, in two cases: the list moves to another file
(`FileSteps.listMoved`, for every view beside it), which also forgets a step it went past, and the file shown changes
under the same row (`SteppedDiffFrame`'s `keepOnly`: an asset's `.meta` toggled in its place). Those neither for the
file now shown nor for one a step is on its way to go, so a file picked in the list while another loads opens at its
top.

**Gaps left.** A press made while the unsaved-edits question is open goes nowhere: the dialog holds the keys and the
pointer. A view that shows another path than its row's (a `.meta` in place of its asset) takes no presses kept for the
row; the `.meta` shows only once asked for in that file, so a step always arrives on the asset.

Hosts keep `FileDiffViewer` mounted from file to file (Incoming's isn't keyed by the file). An xlink's header passes
`FileOnlyNavigator`. Narrow, the label gives way (`data-toolbar-extra`) and the arrows keep the edge. The merge page's
conflict arrows share the order and the label (`ConflictNavigator`), and stay, disabled, once there is nowhere to go
(merge.md "Stepping through conflicts").

A move to a change, or to a conflict on the merge page (they share `scrollToRows`), that is rendered already but more
than a view away jumps to a quarter of a view short of it and glides the rest (`smoothScrollPlan`, `GLIDE_SHARE`), as a
click on the change map does: a smooth scroll the whole way would pass through rows Pierre renders one screen after
another.

## The change map

While a text diff of two versions has changes and scrolls, it draws its own vertical scrollbar (`ChangeMap`,
`--diff-scrollbar-size`), whose track marks where the changes are, as an editor's overview ruler does: the track stands
for the whole diff, so a change a third of the way down the content is marked a third of the way down the track. Each
change is a solid block (`changeMarks`, `changeMarks.ts`), at least `MIN_MARK_HEIGHT` (4 px) tall so one line reads as a
block, in the color the diff marks changed words with inside a changed row: Pierre's translucent word color over the
row's tint, read from its host (`pierreChangeColors`: `--diffs-bg-deletion-emphasis` over `--diffs-bg-deletion`, and
the added ones, which follow the syntax theme). So the map is the diff's own colors in any theme, a step darker than
the changed rows beside it, which it would otherwise run into. A change that removes and adds (`changeKindOf`: `both`)
is split down the middle, the removed color on the left as in a Split diff. Changes close together fuse into one band
("Changes 4–24 of 25" in its tooltip): with at most `FUSE_LINES` (3) unchanged lines between them, however far apart
the diff draws them, or blocks less than `FUSE_GAP` (4 px) apart; the clear gaps left are what make the groups
readable, and the blocks drawn are bounded by the track, not the file.
The marks are the regions the arrows step through (`useChangeNavigation`'s `regions`, so they follow what's typed),
placed where Pierre lays them out (`pierreLineBox`: collapsed unchanged lines and wrapped lines counted) or, until
Pierre can tell, at the line's share of its side.

It shows only for a diff that scrolls, with changes, of two versions (`showsChangeMap`): not for a version shown alone
(an added or deleted file), a file typed into whole, nor where the arrows don't step (the merge page); then the
browser's scrollbar stays, as everywhere. While it shows, the browser's vertical bar is hidden
(`.diff[data-change-map]`) and the map is the first thing in the diff's scrolling element, standing still at its top as
it scrolls and taking no room of its own, as `PaneScrollbars`' bars stay at its bottom: the wheel over it scrolls the
diff, and at rest no code goes under it. It looks like the app's other scrollbars, so a diff and a file shown alone have
the same bar: as wide (`--diff-scrollbar-size` is `--scrollbar-size`, 10 px), no divider, the thumb a 4 px pill 3 px in
from each side, and the marks as wide as the thumb. Under the pointer, and while the thumb is dragged, it grows to 16 px
(`--diff-scrollbar-size-hovered`), to the left over the code's edge without moving the code, as macOS's scrollbars grow:
the marks take the room, the thumb only reaches 6 px. A mark shows the hand pointer, as a press on it goes there. The
thumb (`diffScrollbar`: `thumbOf`, `scrollTopAfterDrag`) is drawn over the marks, translucent in the app's hovered thumb
color (`--diff-scrollbar-thumb`, close to the app's resting thumb over an empty track; the resting `--border-default` is
too faint over the marks in the dark theme; stronger on hover), and dragged with the pointer captured; a press anywhere
across the track's width on the thumb's rows takes it (`pressesThumb`), so the slim pill is as easy to grab as the track
is wide. It moves on the scroll event itself (`useScrollTop`), with the content, not a frame behind. `useChangeMap`
places the marks again (`placesAgain`) when the changes, the layout or the sizes change, or as Pierre measures the lines
above the last change (its estimate of a line not rendered is one row, a wrapped one too): batched to a frame on a
resize or as Pierre renders rows, as `PaneScrollbars` measures. Scrolling alone places nothing again; the colors are
read anew each time, so a theme switch recolors the map.

A press anywhere in the track off the thumb's rows, on a block or between blocks, scrolls smoothly so that point is in
the middle of the view (`scrollTopForTrackPoint`; at once under reduced motion), and dragging on from there scrolls from
that point (`scrollTopAfterDrag`), as macOS's scrollbars do. Farther than a view, it jumps to a quarter of a view short
of the point and glides the rest (`smoothScrollPlan`, `GLIDE_SHARE`), settling in about a quarter of a second: a smooth
scroll the whole way across an expanded file took 3 s, Pierre rendering every line it passed. One rule the eye can
predict: stepping from change to change is the arrows' (⌥↓ ⌥↑, F7 ⇧F7). A press on the track takes no focus and is no
press in the diff: the caret typing in it stays, and no lines are picked. It's for the pointer only (`aria-hidden`).
Always on, with no setting.

Designs tried on screen and dropped, not to be proposed again:

- **A lane beside the browser's scrollbar**, or marks under it: a strip floating next to a bar it doesn't belong to,
  and the browser's bar is the system's, its track paging on a click. The map is the bar instead.
- **Colors mirrored as tokens** (Pierre's `--diffs-added-light` and the like copied into `tokens.css`): those are only
  Pierre's fallbacks; the diff's colors come from the syntax theme, so the copies never matched what it shows. They're
  read from Pierre at run time.
- **Marks in the gutter bars' strong red and green**, or that color mixed into the track (25% to 45%), full width or
  in narrow lanes: loud next to the rows' tint, noise beside the code. The changed words' color is the strongest that
  stays quiet.
- **The rows' tint alone**: a block beside changed rows ran into them, the map and the code read as one; on white it
  was too faint to find.
- **An edge around each mark**, in the gutter's color, a softer tint of it or a neutral gray: long blocks read as
  empty boxes, and the edges as more lines.
- **One color for every change** (the "changed" blue, or a neutral gray): the gray ran into the thumb, and the blue
  was one more color the diff doesn't use.
- **A wider track with a divider**, or a framed thumb: a bar unlike every other scrollbar in the app, and a frame faint
  enough to lose. Growing past 16 px under the pointer looked out of proportion.
- **Two lanes of dots**, removed lines on the left and added on the right, each placed by its own lines: read as a
  texture, not as changes, with no boundary between groups. One column of blocks, close changes fused, reads at a
  glance.
- **A click that went to a change** (through the arrows' navigation, "3 of 12"), and scrolled elsewhere between marks:
  two rules for one click, a mark a few pixels tall decided which. A click scrolls there, as on any scrollbar.

## Expanding the diff

Expand Diff gives a diff the whole window to read in: the sidebar, the files beside the diff, the view's or page's
header (a breadcrumb, filters, a changeset's summary, a review's header, a history's revision, a file's details) and the
status bar go out of sight, and the diff keeps its own header. The top bar stays: it holds the window's own buttons
(the traffic lights on macOS, the caption buttons drawn over it on Windows, `titleBarOverlay`), so the diff's header
never runs under them; Linux keeps its native title bar. So does the command log, when open. It is a layout of the app,
never the OS's full screen (View ▸ Enter Full Screen, ⌃⌘F, F11), which it stacks with independently, and its name says
so: "Full screen" names the OS's.

- **Where**: one icon button, in the diff's header, right before the change arrows (`ExpandDiffButton`, drawn by
  `DiffViewerFrame` where its host says it can expand: `ExpandableDiffContext`), pressed while expanded; ⇧⌘E or
  Ctrl+Shift+E (`expandDiff`: E for Expand, taken by no browser, desktop or the diff's editor); View ▸ Expand Diff and
  the palette (`view.expandDiff`, `useDiffExpansion`). Its tooltip says how to leave before the mode starts.
- **Every diff beside its files**: Changes, a diff page (changeset, branch, shelve, label, range), a code review,
  History, Incoming, a file's content in Files and Browse repository, and a page window, where it hides that page's
  files. The merge page offers none, nor do Incoming's conflicts or a dialog's diff (See in context).
- **The files stay mounted**, out of sight (`SplitPane`'s `stowed`, `Stowable`, `DetailsPanel`'s `changesOnly`): their
  scroll, selection and filters come back as left, and nothing is read again. Where the diff steps on to the next file
  past its last change (`FileStepsContext`: Changes, Incoming, a diff page, a code review), it still does, so a whole
  changeset is reviewed expanded. History, Files and Browse repository step through the file shown only, as they do
  collapsed.
- **The keyboard goes to the code** (`focusGoesToDiff`) when what held it went out of sight or was a button a click
  focused (the Expand button, a change arrow clicked before), and the code is the window's main focus while expanded
  (`useExpandedDiffFocus`): focus that falls to the page (a menu or dialog closed, the editor left with Esc) comes back
  to it. A button the keyboard reached (Tab to Expand, then Enter) keeps it, its ring showing where focus is, as a
  toggle does (`FocusHolder.ringed`). Collapsing from the keyboard (Esc, the shortcut, the palette, the menu, Enter on
  the button) keeps it where it still shows, normally the code, so ⌥↓ and the arrows work at once; from nowhere (a step
  to another file left it on the page) or a button a click focused, the code takes it (`focusGoesToDiffOnCollapse`),
  never the list it had before. A click on the button leaves it there. The app moving focus draws no ring (`focusAs`,
  ARCHITECTURE.md "Focus").
- **Keys of what is out of sight** never act on it unseen (`shortcutWhileExpanded`, `runWhileDiffExpanded`): ⌘↩ gives
  the window back, then checks in (an empty summary takes the caret); Toggle Sidebar only gives the window back, the
  sidebar showing as it was; Go to file acts, the file picked showing in the diff, as choosing another file does;
  Incoming's Esc that stops a resolve run is off (`useShortcutOnWhileExpanded`), so Esc collapses the diff instead.
- **What ends it** (`diffExpansion.ts`): the button pressed again, the shortcut, Esc, the navigation leaving the diff
  (another view, a page opened over it or gone back from: `leavesExpandedDiff`), the window leaving the place, or the
  view in front settling with nothing to diff (nothing pending after a check-in or an undo, a diff whose filters hide
  every file, Incoming up to date, no file selected in Files or Browse repository, no revision left in History:
  `collapsesWithHost`, from `changesDiffs`, `diffPaneDiffs`, `incomingDiffs`, `selectedFileDiffs`, `listedDiffs`). A
  view hidden under a page that empties never ends the page's expanded diff, which is still in front. Choosing another file keeps it,
  and so does a read under way (the next changeset of a branch) or a page window following the selection to another
  object (a page replaced at the same depth). It belongs to the window and is never remembered.
- **Esc** collapses only once nothing else took it (`escapeCollapsesDiff`): a menu, the palette or a dialog closing, the
  picked change dropped, the editor leaving the text, a field typed into, a command bound to Esc (a pending cut in Files
  cancelled). History's and Files' "Esc back to the list" give way to it while expanded (`escapeBackToList`): the list
  is out of sight.
- With no diff in front, the shortcut does nothing (`expandedAfterToggle`) and the palette greys the command out
  (`expandDiffOffered`). View ▸ Expand Diff stays enabled in every place (the native menu knows only the place shown,
  `isMenuCommandEnabled`) and does nothing there.

## Lines for links

A diff's line numbers select lines, as on GitHub: a click selects one, Shift+click or a drag a range (`useLineLinks`,
Pierre's line selection). Those of a committed diff (a changeset's, branch's, label's, shelve's, range's or review's:
`DiffBrowser`, which says so through `LineLinksContext`), a history's annotations (`HistoryPage`), a file browsed at a
changeset (Browse repository, its newer side) and an unchanged file of the Files view (`useFilesItemLinks`, while no
page covers it) are the ones "Copy link" names (`#L40-L52`, `#old-L7` on the
older side): `selectedLinesStore` keeps the file and lines selected in the diff on screen (`selectedLinesIn`), forgotten
as the file leaves it. A history offers them only annotated (`historyLineLinks`): its link names lines only there.
What the lines selected offer (the "Copy link" chip by them, the right-click menu, the hint on line numbers) is
deep-links.md "Where links are copied"; `useLineTools` wires them into `TextDiff` and `AnnotatedCode`. A selection across both sides (unified, from a removed line to an added one) keeps its end on the
newer side (`linkedLinesOf`). A workspace file's diff picks lines to discard them instead (`useBlockDiscard`).

A page opened on a file's lines (`focusPath` with `focusLines`, a link's) opens that file scrolled to them, a third of
the way down, and selected (`scrollToLine`, from where Pierre lays the line out, rendered or not); its unchanged lines
show unfolded, as a link may name one (`collapseUnchanged` off for that file). Once: selecting another file drops them
(`linkFocusOn`), so coming back leaves the file where the user was. Changes takes them from outside
(`requestLineFocus`, `useRequestedLineFocus`): the pending change's diff scrolls to them and shows them as Pierre's
selection until lines are picked to discard, Pierre echoing them back picking nothing (`useLinePick`'s `marked`).

## The code's menu

A right-click on code opens its menu (`codeMenu`, wired by `useCodeMenu`, every choice in `codeTarget`): every text
diff's sides, the whole-file editor, a merge's hand-editing (`HandEditor`) and Annotate (`AnnotatedCode`). The merge
page's conflicts (`ConflictHunks`) have none: Pierre numbers each side of a conflict there on its own (both read line
3), so no line number or selection there names one text to go to or compare. It follows the menus' one grammar, so it
reads, in groups: Undo, Redo; Find, Replace, Go to line…, Compare with clipboard; Cut, Copy, Paste; Delete, Select all.
Where a diff selects lines for links (a committed diff, Annotate), the lines' own entries join it at the end of their
groups ("Annotate at this line", "Copy link to line 42", "Copy line": `lineMenuEntries`). What it holds depends on the
side right-clicked (`codeMenuTarget`):

- **Typed into** (the newer side of a workspace file's diff once its editor is attached, the whole-file editor, a
  merge's hand-editing): everything, through Pierre's editor. Undo and Redo are its history (`canUndo`, `canRedo`). Cut,
  Copy and Paste are Pierre's own, as ⌘X, ⌘C and ⌘V (`runEditorClipboard`): the editor is focused and the page runs
  `document.execCommand('cut' | 'copy')`, and since Chromium refuses a page's paste, the window pastes
  (`windows.pasteClipboard`, Electron's `webContents.paste`). So several carets copy and paste their own pieces, a bare
  caret's Cut and Copy take its whole line, and a paste takes the file's line breaks (Pierre's `TextDocument` keeps the
  first one it reads: a CRLF file stays CRLF, which `diskText` wouldn't repair). Delete removes what every selection
  holds (`deletionEdits`), Pierre's `applyEdits` moving the carets; Select all selects the whole text.
- **Read-only** (every other side): only what reads it. Copy copies the text selected in the page, read from its rows
  (`pageTextSelection`, `copiedPageText`); lines picked by their numbers have "Copy lines" instead. Select all selects
  every line of the side, as Shift+click would, where lines are selected for links. Undo, Redo, Cut, Paste and Delete
  aren't offered, nor Find and Replace: Pierre's search panel is its editor's, and a read-only side has none.
- Entries that need a selection are off without one, their tooltip saying so (Delete, Compare with clipboard, a
  read-only side's Copy; `codeMenuState`); Paste never waits on the clipboard.

As the official client's menu did, but in the app's grammar and words. Its Delete with nothing selected did nothing, so
it's off then; its Replace was ⌘H, which hides the app on macOS.

**Keys.** The menu shows the keys the editor takes on each OS, from the registry's "Text" area (`textUndo`...
`goToLine`). Replace is ⌥⌘F on macOS and Ctrl+H on Windows and Linux, where Pierre's Ctrl+Alt+F is AltGr+F on European
layouts: `pierreEditorKeymap` gives the editor the registry's key, and Pierre's own still works. Go to line is ⌃G on
macOS (⌘G is Find next there) and Ctrl+G elsewhere, from anywhere in the code, Pierre's search box included
(`editorHasFocusIn`); with Pierre's search panel open, Ctrl+G off macOS is its Find next. Ctrl+H typed in Pierre's
search box doesn't switch it to Replace on Windows and Linux: the box takes its own keys, and only Pierre's ⌥⌘F
(Ctrl+Alt+F), or the arrow at the panel's left, does there. That arrow shows and hides the Replace row on every OS.

**Find and Replace** open Pierre's search panel, which `Editor` has no public way to open (`openPierreSearchPanel`, see
Pierre workarounds): the menu presses the key that opens it on the editor's content element, its modifier held as Pierre
reads the platform (`pierreReadsMac`), so Replace opens from the menu on a Mac previewing another OS
(`UVCS_RENDERER_PLATFORM`) too.

**Go to line…** asks for a line of the side it's on (`goToLine`: "Line number (1–240)", the caret's or the line
right-clicked already in the field), takes only a line that side has and says which it has otherwise. The line scrolls a
third of the way down (`scrollToLine`; Annotate's own rows in place); typed into, the caret goes to its start, and
read-only, it is selected where lines are and focus comes back to the pane without its keyboard ring
(`focusAs`, as the app moved it): the line shows where the user is, and the dialog's keys would make Chromium ring the whole pane. A
Tab into it still rings it. A line of a region "Collapse unchanged lines" folds away is shown first (`scrollToShownLine`
in `TextDiff`, for a link's lines too): Pierre's `FileDiff.revealLine` expands only that region, from its nearer end,
and an older side's line is the one as far into the same region on the newer side, which Pierre reveals
(`lineToReveal`). ⌃G goes to a line of the text typed into while the caret is in it, else of the side whose lines are
selected, else of the newer side (`keyboardGoToLine`).

**Compare with clipboard** compares the code selected with the text on the clipboard, in the moved code's dialog
(`openCodeComparisonDialog`): the clipboard on the left, the selection on the right, "Clipboard compared with lines
12–18" over the file's name and version ("Player.cs (after)": `clipboardComparison`). The selection is the text
selected, to the character, or the lines picked by their numbers; text selected across both sides of a unified diff is
no one version's code, so it compares nothing. The menu only asks whether there is code (`hasCode`), and reads it once
the entry is chosen. Both texts are compared as they show (`clipboardText`): line breaks are LF and each last line
ended, so the clipboard's CRLF and a missing final line break don't show as changes. It's offered with a selection,
whatever the clipboard holds: reading the clipboard as the menu opens would ask the OS for its content (an image, a huge
text) at every right-click, and the menu would show before the answer. An empty clipboard, or one the page can't read,
says so in a toast. The official client's "Add diff selection" then "Diff with previous selection" took two steps and
kept the first selection; copying is the step people already know.

## Moved code

Every text diff tells code that moved from code removed and added, in the renderer, from the one `lineDiff` (no `cm`
command, and it follows what's typed). `detectMovedBlocks` (`features/diff/viewer/movedBlocks`) takes each change's
removed and added sides and looks for the other side of another change, or a run of its lines, holding at least 80%
of its words (`MOVED_SIMILARITY`): words are runs of letters and digits of any script, compared under the comparison
method, and counted by a bounded edit distance (`diffArrays` with `maxEditLength`), so code moved and edited a little
is still a move. The official client's rules, which it was taken from: a change whose own two sides are that alike is
an edit in place, never a move; a move is 2 lines at least (`MIN_MOVED_LINES`); a diff of more than 50 changes or 500
changed lines (`MAX_BLOCKS`, `MAX_CHANGED_LINES`) is a rewrite, not looked into. Unlike it, lines with no letter or
digit (braces, blanks) are never a move, each line is in one move at most (the closest match wins), and a diff spends
20,000 comparisons at most (`MAX_COMPARISONS`). Their work is bounded too, to `MOVE_WORK_BUDGET` at most (2,000,000
word comparisons, some 150 ms at worst), counted as they're made: Myers' algorithm takes up to (2 edits + 1) times the
shorter side's words plus the edits squared, so a comparison allows no more edits than half the work left over both
sides' words. Long sides alike but for a few words are still found moved (paragraphs of prose, long lines); long sides
far apart are given up early. A change whose own two sides can't be compared within that work (`UNAFFORDABLE`) is left
out on both ends, never taken for a move when it may have been edited in place. A
change whose two sides could neither be a move (a line each, as in a minified file) isn't compared at all, nor split
into words when no change has two lines: the one line of a minified file of 800 KB, compared with what it became,
held the window for minutes. A limit on the changed lines' characters was tried instead and dropped: it hid real moves
among rewritten paragraphs. There are no settings: the official
client's three (on, similarity, minimum lines) sit in a menu few find, and these defaults are its own.

What shows (`useMovedCode`, `MovedCode`):

- Every line of a move takes `--change-moved`, the color of moved files in lists, where it'd take red or green
  (`movedCodeCss` sets Pierre's `--diffs-deletion-base`/`--diffs-addition-base` on its rows and number cells, which
  recolors the number and the bar, and their background to a lighter `--diff-moved-tint` through Pierre's
  `--diffs-bg-*-override`s), so what moved shows at a glance and reads as one block, quieter than the changes around it. The lines
  changed on the way (edited, or only added or removed inside it: `MovedBlock.changed`) are tinted a little stronger
  (`--diff-moved-edited`) and their changed words stronger still (`--diff-moved-word`). Tried and rejected: the lines
  changed on the way in red and green (a move broken into pieces that read as changes of their own); every moved line
  in red and green with the moved color on the labels only, as the official client keeps its own colors, or on the
  line numbers too (in neither did what moved show at a glance).
- The words a moved line changed are marked against the line it became, as the official client marks them: within a line diff of the two places (`MovedBlock.changed`),
  each removed line pairs with the following added line most like it (`MovedBlock.replaced`, half of their words the
  same at least; a line only added on the way pairs with none), and the pair is word-diffed as Pierre diffs one
  (`movedWordMarks`, `lineWordMarks`, `WORD_MARKS`). Pierre's own marks on moved lines compare them with whatever line
  stands beside them, so they're dropped (`movedCodeCss`) and these drawn with the browser's highlights
  (`useMovedWordMarks`, `CSS.highlights`, drawn again as rows render). Marking Pierre's rows instead
  (`refreshWordMarks`) was rejected: each of its renders (its worker's colors, a keystroke) draws its own marks back.
- Each place has a label, "Moved to line 143" or "Moved from line 4" with an arrow toward the other place, that scrolls
  there and lights it up (`scrollToChange`, `useChangeFlash`). It goes in the hatched gap across from the place when
  one is beside half of it at least (`labelSpot`: the space that says the code is gone tells where it went), else at
  the right end of the place's bottom edge: the top edge is the change's chip's. In a pane narrower than 320 px it
  shows the arrow and the number only, the words in its tooltip.
- The label's other button, "Compare moved code", opens the two places side by side (`openMovedCodeDialog` of
  `movedCopies`, in the dialog "Compare with clipboard" opens too, `openCodeComparisonDialog`): a read-only diff of what
  moved with what it became, in the diff's look, layout and comparison method, so only what changed on the way shows as
  changed. Code moved as it was, or with only what the method ignores changed, shows alone, its note saying so ("Moved
  without changes", "Only whitespace differs"): a diff with no line changes has no lines for Pierre to show
  (`movedComparison`). Its lines are numbered from the start of the moved code (Pierre numbers a diff from 1); the title
  says where both places are. Putting the two places side by side in the diff itself, each side scrolling on its own,
  was rejected: everything in the diff (its gaps, navigation, discards, the editor, the labels) relies on both sides'
  rows lining up.
- Pointing at moved code or its label lights the move up in both places and, side by side, draws a ribbon joining them
  (`ribbonPath`, level with the rows at both ends) over the last 24 px of the removed side's pane, where code is least
  likely to be, up to the seam; it goes once the pointer leaves, and the pointer and selections go through it. A place
  not rendered yet is where Pierre lays it out (`pierreLinePosition`). A ribbon always shown took room between the
  panes, which opened and closed as code was moved and saved; one always shown over the seam would cover long lines.
- A big text diffed only once typing pauses (`diffsEveryKeystroke`) hides its moves until then: its lines move under
  them meanwhile. Other texts are diffed at every keystroke, and their moves follow.

A move isn't a stop of its own when moving through changes: its two places are changes like any other.
`scripts/sandboxes/moved-code.sh` builds a changeset and pending changes that move code.

## Comparison method

Every text diff compares lines under the official client's methods (Ignore EOLs, Ignore
whitespaces, both, Recognize all; one global preference, Recognize all by default). Lines are compared trimmed
(`features/diff/viewer/comparisonMethod`) through a line comparator, so the diff still shows and discards the
original text. One function computes the diff of two texts under a method (`lineDiff`, Pierre's `parseDiffFromFile`
with the comparator as `parseDiffOptions`), and everything reads that one result: what the diff shows (`shownDiff`),
the +N −M, whether the file is typed into whole ("Only whitespace differs"), and the blocks and lines discards act on.
Every line diff (`diff`'s, Pierre's too) compares lines by id, each line's key read once, and runs Myers' algorithm
only within a budget (`boundedLineDiff`, `boundedDiff`): past it, lines found once in each text anchor them (patience
diff) and what's between is diffed on its own, so a rewritten or much-changed file takes linear time, not minutes.
While the file is typed into, Pierre re-diffs it itself, with the same `parseDiffOptions`: `pierreLineComparison`
patches the places Pierre 1.6.2 doesn't (a keystroke's shortcut takes lines equal only when they're the same
text, and text typed back to the original's shows no change), re-renders the diff whole when a keystroke leaves rows the diff doesn't have, and its
test fails when a Pierre update moves them. `pierreTyping.test.ts` types into diffs of every kind of text (line
breaks, final line breaks, whitespace, empty sides) under every method, checking after each keystroke that Pierre's
diff is `lineDiff`'s and that the rows on screen are the diff's (`pierreSessionFixture`, which hands Pierre each
keystroke as its editor does, with the line typed into and the document's line count). `cm` commands keep their own
comparison: merges don't change with it.

## Line breaks

Lines end with LF, CRLF or the lone CR of classic Mac files (`lib/lineBreaks`). Pierre and `diff`
break lines only at LF, so everything they get (diffs, the editors, conflicts, whole versions) shows each lone CR as
a LF (`shownText`), with the same lines. Everything else keeps the files' own text: the editor's text goes back to
the file's line breaks as it's typed (`diskText`: kept lines keep theirs, new ones take the file's most common),
discards and merges split lines at all three, and one side of lone CRs against one of LFs still differs under the
methods that recognize line endings (`crAgainstLf`); a file mixing both can't tell which of its LFs were CRs.

## Long lines

Chromium draws nothing of a line of text past some 1,300,000 characters (measured: 1.3M drawn, 1.4M blank, at any font
size), so the one line of a minified file of 1.6 MB showed as an empty row. A text with a line longer than
`LONGEST_DRAWN_LINE` (1,000,000 characters, `features/diff/viewer/longLines`) has its lines wrapped wherever they can
wrap, whatever the wrap preference (`hasLineTooLongToDraw`): the diff (its wrap button pressed and unavailable, its
tooltip saying why) and the merge page's texts (`usePierreOptions`). Annotate can't wrap, its rows being one line high
beside their annotation, so it cuts such a line there with an ellipsis (`withLongLinesCut`); that text is read-only,
never written back.

A text with a line longer than `LONGEST_EDITED_LINE` (50,000 characters) isn't typed into in the app
(`hasLineTooLongToEdit`): Pierre's editor takes time by the square of a wrapped line's length at each keystroke
(measured: 100,000 characters 0.24 s a key, 300,000 3 s, 700,000 18 s, 2 MB more than three minutes; unwrapped, 700,000
took 70 ms, but the user may wrap any line). Such a pending file's diff is read-only (`typesIntoDiff`), a line above it
saying why, with Open file, also above the line saying it has no changes to show; the merge page doesn't offer "Edit
the text in the app" for it (`editInAppUnavailable`, its tooltip saying why). The limit reads the texts as read, not as
typed: a long line pasted into a file being edited keeps it editable until it's saved, since turning the editor off in
the middle of an edit, unsaved text and all, would be worse than a slow keystroke.

Everything else a long line costs is already bounded: Pierre highlights no line past `tokenizeMaxLineLength` (1,000
characters, its default) and marks no words in lines past `maxLineDiffLength` (`WORD_MARKS`), and comparisons of moved
code are bounded by their work (`MOVE_WORK_BUDGET`, "Moved code"). Opening a pending diff of a 3.9 MB one-line file
takes about 2 s, most of it Chromium laying out the wrapped line; 1.6 MB, about 1 s.

## Images

An image's bytes cross IPC as binary (`FileContent.image`, a `Uint8Array` and its type, 40 MB a side at
most) and are painted from a blob URL that lives while it's shown (`useImageUrl`), never a data URL (35 MB of text for
a 25 MB PNG, decoded again at every paint). The URL is revoked as the image changes, so what is painted is only ever
the decode of the image's current URL (`shownDecodeState`): an `<img>` still given the one before fails to load.

## Unity's texture formats

TGA, TIFF, Photoshop (PSD and PSB), OpenEXR and Radiance HDR show in the image diff like any other image: every mode,
the info strip, the pixel inspector, and the merge page's version cards (`WholeFileChoice`). Main reads them as images
of their own type (`DECODED_IMAGE_TYPES`, by extension, within `MAX_IMAGE_BYTES` as every image), and the renderer
makes each into an image the browser paints before anything shows it (`usePaintableImage`):

- **Off the UI thread**: in the image decoding worker (`imageDecoding.worker`, a `paint` request; `paintOffThread`
  in `imageDecodingSession`), never on the page's thread, where a 4K PSD or EXR would hold a paint; a worker that can't
  start or dies fails the image. The session hands the worker at most two requests at a time, a texture's or an
  image's, from one queue (it bounds the bytes in the worker's hands; two may be under way at once, as a texture's
  decode awaits `createImageBitmap`); an image asked again while in hand is asked once, and one every viewer let go of
  (`release`, in the effect's cleanup) before its turn is never handed over, so stepping through files queues only the
  one on screen. The decoders are the textures' own (`lib/images`: `decodePixels`, three's loaders for TGA, TIFF, EXR
  and HDR, `readPsd` for Photoshop), loaded only in the worker. A second worker for images was tried and set aside: a
  second thread and a second copy of three's loaders, and a client that repeated the decoding worker's line for line.
  What sharing costs, accepted for that: one queue, so a model's textures and an image diff wait for each other; and
  one failure, so a parser that hangs on a file holds both, and a worker that dies fails textures and images alike
  in that window until it reloads.
- **By content first** (`imageFormatOfContent`: a PNG saved as `.tga` paints as the PNG it is, told on the page with
  no trip to the worker: `needsDecoding`), else by its type; its size read from the header and refused past 16384 px
  a side or 8192² pixels before decoding (`sizeProblem`, the model diff's limits, where a texture is drawn at 2048 px at
  most). What an image costs at its size, 4 bytes a pixel each (256 MB at the limit): in the worker, its RGBA pixels and
  its BMP while it is written (an EXR or HDR holds 16 bytes a pixel of floats first: 1 GB at the limit); on the page,
  the decoded `<img>`, and, once Differences or the pixel inspector read it, its pixels (`rasterize`); the BMP itself
  stays in a Blob, out of the page's heap. A browser image under the image cap has no pixel limit today.
- **As a BMP** (`bmpOf`): the decoded pixels are written as a 32-bit BMP with an alpha mask, which `<img>` reads as it
  is: no compression to spend time on, and a see-through pixel keeps its color. It crosses back from the worker as a
  Blob (`PaintableImage`), a handle, and the page keeps only its URL. A PNG made through a canvas was set aside: the
  canvas premultiplies alpha, losing the color of every transparent pixel, and encoding takes long. Chromium keeps a BMP
  whose alpha is 0 in every pixel transparent, as the texture is (checked in the app: some BMP readers take such an
  image as opaque, guessing its writer left alpha unset).
- **High dynamic range** (EXR, HDR) shows as the model diff's textures do: clamped to 0-1 and encoded as sRGB. The info
  strip says so ("HDR", its tooltip saying it shows clamped: `HIGH_DYNAMIC_RANGE_TIP`), and the pixel inspector tells
  the colors shown, "as shown", not the file's values. 16-bit channels show as 8 bits.
- **What can't be painted** (a PSD saved without "Maximize Compatibility" or in CMYK, Lab, indexed or 32 bits, a header
  past the limit, a damaged file; `imagePairView`): a version that can't, beside one that can, leaves that one shown
  alone, as an added or deleted image is, under a line saying which version is left out and why (`unpaintedNotice`):
  a PSD saved again without "Maximize Compatibility" still shows as it was. When none can, an image past the pixel
  limit reads as one past the byte limit ("This image is too large to preview", the sizes, and "Open file" for a
  workspace file: `TOO_LARGE_TITLES`, `sizeChange`, `OpenFileButton`, shared with `NothingToDiff`), and any other
  shows the binary diff's sizes and why, in the texture problems' words (`undecodedDescription`,
  `imageProblemWords`). The header's mode switch stays over these: it is chosen before the versions decode. A merge
  card shows its file icon with why in its tooltip (`undecodedTip`).
- **The byte cap**: a PSD over `MAX_IMAGE_BYTES` (40 MB) is "too large to preview", as any image, though Photoshop files
  often pass it. To do: the model diff reads its textures up to 256 MB through another path (`MAX_TEXTURE_FILE_BYTES`,
  within the read's `MAX_MODEL_BYTES`); the image diff could read a texture as large, once a version's bytes crossing
  IPC whole stops being the limit.
- Nothing is kept once a viewer goes: going back to a file decodes it again.

## Images written as text

An SVG reads as both (`toFileContent` ships its text and its image; past the text cap,
only the image), so its diff shows rendered or as text, with a "Code | Image" switch in the header remembered per
extension (`representations`, rendered by default). The text keeps every text feature (editing, discarding, the
comparison method); the image every image mode, with unsaved edits rendered. SVG is only ever painted through `<img>`
(no scripts, nothing fetched), and one declaring a huge size is drawn within 16 MP (`decodedSize`).

## Rows under lines

A place showing a committed diff can add to each file's diff without the diff knowing what it adds (a review's comments,
docs/features/code-reviews.md "Comments in the code"):

- `EntryAnnotatorContext`: a component wrapping each file's diff of a `DiffBrowser` (`EntryDiff`), which may add
  controls to its header and compare other versions of the file than the entry's (`AnnotatedEntry.compared`: a
  comment's own, in the changeset that applied it; "Since review" is then off). It may load on first use.
- `EntryFlagContext`: what a place flags among a `DiffBrowser`'s files (`EntryFlag`): an icon by the status letter of
  each flagged file's row (`ItemMark`, after the review mark, its words in the tooltip), and, where the place names
  one (`filterLabel`), a chip after the status chips showing only those files (`useChangeFilter`'s `flag`,
  `matchesChangeFilter`'s `onlyFlagged`): a review's files with comments, "Commented".
- A `DiffBrowser` in a dialog (See in context's) names nothing for Copy link or a new window (`publishes={false}`: the
  page behind keeps its file and lines named) and offers no Expand Diff (`DiffBrowserLayout`'s `expandable={false}`:
  the window isn't the dialog's to lay out).
- `DiffAnnotationsContext`, read by `TextDiff`: rows under lines (Pierre's `lineAnnotations`, `lineNumber: 0` above the
  code), markers at the end of lines (`LineMarkers`, placed by `useLineBoxes`, which the lines' Copy link chip uses too;
  it measures again when the code panes resize, as Pierre's host, at least as tall as the view, doesn't grow in a short
  file when a row goes in above the code), and a line whose row to scroll to (`scrollToAnnotationRow`): the line and its
  row, or the part of the row marked `ROW_FOCUS_ATTRIBUTE` (one thread of several), read with context: the line a third
  of the way down, its row below; a row taller than the room below scrolls on just enough to fit, keeping three lines
  above the line; a line near the top stays at the top, one near the end stops at the end (`focusScrollTop` in
  `lib/scrollPlacement`, through `framedScrollTop`; nothing moves when they already show, away from the edges). The line
  ends where its row starts (`lineAboveRow`): side by side, the box Pierre lays a line out in spans the whole row, the
  card under it included. A row the diff already shows is glided to (`scrollSmoothlyTo`); one not rendered yet is jumped
  to where Pierre lays its line out, then set right as rows render and grow. While the place goes to one of its rows
  (`opensAtRow`), the diff doesn't open at its first change (`openingStep`'s `opensOnLines`), which would scroll past
  the row once placed. Every row's and marker's line is unfolded from a folded unchanged region (`linesToReveal`,
  Pierre's `revealLine`), at each render: Pierre lays a diff out anew at times (its highlighted text replacing the plain
  one), folding its regions again, and a line already shown unfolds nothing.
- `DiffFocusRequestContext`: a file to show again, while the diff is on screen (`DiffBrowser` selects it; a branch's
  diff switches to the mode and changeset asked for, `BranchDiff`).

Rows are slotted into Pierre's shadow root, whose code inherits a monospace font and `pre` spacing: a row sets the
app's own text back (`InlineThreads.module.css`). Pierre's React `FileDiff` keys each row's slot by its index in
`lineAnnotations` (`renderDiffChildren`), so a row whose index changes is mounted anew, losing what it held (an open
reply): a place lists rows that come later after the others (`annotationRowsOf`).

## Review marks

`main/review/ReviewStore` keeps, per workspace, the fingerprint of each file marked reviewed (and a copy of its text,
read as the `reviewSnapshot` content source) under `<userData>/review-snapshots/`; marks of paths that leave the pending changes are dropped.
Committed diffs (changeset, branch, shelve, range, code review) keep marks too, in `main/review/DiffReviewStore`: per repository,
by the diff's name (`cs:42`, `br:/main/task`, `sh:3`) and the revision reviewed, so a branch's file is changed since its review once
another revision shows; the least recently reviewed diffs are forgotten. `features/review` holds the shared list pieces.
Marks only show in review mode, a per-workspace setting (`reviewModeWorkspaces`, off by default); leaving it keeps the marks.
Its toggle (`ReviewModeButton`) ends the filter bar of the lists that review (Changes and every diff), and the review bar
(`ReviewBar`: progress, the "Unreviewed" filter, mark all, clear) opens right beneath it, between the filter bar and the
list (and its header, in Changes): the toggle never moves as the bar comes and goes, and it is the one way out of review mode. The view's header was
rejected: far from the bar it opens, and in a different place in each view.
In a tree, a folder's mark marks every file in it, and shows how many are reviewed while some are (`partialReviewCount`).
R toggles the selection's marks; marking one file moves on to the next one still to review (`stepToNextReviewable`):
past directories, which have nothing to review, files already reviewed, where R would clear the mark, and open folders
and groups, whose files come next; a closed one holding a file to review is a stop. With none left below, it stays.

## Pierre workarounds

Each place the viewer reaches into Pierre (1.6.2) or `diff` past their public API is one module named for it. Those
that patch or read internals have a test that fails when an update moves them, and a method they wrap hands Pierre's
own every argument past the ones it reads (`pierreWrappedArguments.test.ts`), as Pierre adds some. package.json pins
@pierre/diffs to exactly 1.6.2, not `^1.6.2`: 1.6.3 was published with unresolved `workspace:*` and `catalog:`
dependencies and doesn't install, so a range would break `npm update`; it goes back to a `^` range with the first
release that installs.

- `pierreDom`: where Pierre renders (the `diffs-container` shadow root, its rows' `data-line-type`, `data-line` and
  `data-column-number`), the gutter button slot moved to the hovered line, hovering anew under a still pointer, and
  the text selected in the page (`pageTextSelection`, through Chromium's `ShadowRoot.getSelection`).
  The tests run without a page, so this one is checked on screen. Wrapping lines, a pane (`data-code`) has no box of
  its own (`display: contents`), and its code column stands for it (`paneRect`).
- `movedCodeCss`, `MovedCode`, `useMovedWordMarks`: moved code recolored through Pierre's `--diffs-deletion-base` and
  `--diffs-addition-base`, its labels in the gaps across from it (`data-content-buffer`), and its words marked over a
  row's text nodes, which hold its line in order (`rowTextRange`). Checked on screen too.
- `pierreLineComparison`: typing re-diffs under the comparison method (see Comparison method).
- `pierrePlainTextRender`: a diff shown as plain text renders once, not at every render (see Editing in the diff).
- `pierreSessionEndRefresh`: a diff typed into isn't highlighted again as it goes away (see Editing in the diff).
- `pierreWordMarks`: a diff typed into marks the changed words once typing pauses, in the rows Pierre keeps (see
  Editing in the diff).
- `pierrePlainTextWordDiffs`: a diff shown as plain text marks changed words past 1,000 lines (see Editing in the diff).
- `pierreSearchPanel`: the code's menu opens Pierre's search panel, which 1.6.2's `Editor` opens only from its keymap
  (`openSearchPanel`, `openSearchReplacePanel`, reaching the private `#openSearchPanel(mode)`), by pressing the key
  that opens it on the editor's content element; `pierreSearchPanel.test.ts` checks through Pierre's own
  `resolveEditorCommandFromKeyboardEvent` that the key reaches the command on every OS. The keymap it gives the editors
  (`pierreEditorKeymap`) puts Replace on the registry's key (see The code's menu).
- `editorClipboard`: the code's menu runs Pierre's own `copy`, `cut` and `paste` listeners (`runEditorClipboard`).
  It relies on `Editor.focus()` (`#focus`) putting the window's selection inside the content element at once
  (`#setWindowSelection`), DOM focus coming later (`queueRender`): `document.execCommand('copy' | 'cut')` fires where
  the selection is. Checked on screen: several carets copy and paste their own pieces.
- `pierreLinePosition`: where a line not rendered yet sits, to scroll to a change
  (see Moving through changes), and where the change map places its marks (see The change map).
- `pierreChangeColors`: the tints Pierre gives removed and added rows and the color it marks their changed words with,
  read from its host's computed `--diffs-bg-deletion`, `--diffs-bg-addition` and their `-emphasis`, for the change map's
  blocks (see The change map).
- `pierreHighlightWorker`: the entry the highlighting worker starts from. Pierre's worker chunks import `worker.js`
  back, and the development server loads it twice when the worker is started by Pierre's own URL: two copies answer
  every request, and the one never set up fails (`pierreHighlightWorker.test.ts`). `electron.vite.config.ts`
  pre-bundles it, so the first big diff doesn't make the development server reload the page. `useHighlightWorkers`
  switches the worker's theme after the render: Pierre's components it highlights for update their own state then.
- `boundedLineDiff`: every line diff, `diff`'s and Pierre's, keys lines once and stays linear (see Comparison method).

## Memory

Why one highlighting worker. Measured on a task branch of a large production repository (52 files, up to 240 KB each), stepping through its diff a file a second:

- **GPU process**: Skia's Graphite (Chromium's default renderer on macOS) takes about 450 MB more in the GPU process
  for as long as anything repaints, a blank window too, and gives it back a second after. Ganesh, the renderer
  before it, stays under 61 MB, but the app keeps Graphite: it's where Chromium is going, and the memory isn't kept.
- **Highlighting**: each of Pierre's workers grows its heap by what it highlights (to about 90 MB there), and
  highlighting in both themes at once takes half as much again. One worker in the app's theme (`useHighlightWorkers`)
  takes the renderer's peak from about 430 MB to 320: the next big text waits for the one before, and a theme switch
  highlights again the texts on screen (`setRenderOptions`).
- The rest is garbage between collections (the page's heap reaches about 95 MB for 25 used; Pierre's structured
  clones of highlighted lines, Myers diffs, Shiki on the main thread): the renderer goes back to about 130 MB once idle.
- **What stays once a diff is gone**: Differences keeps the pair it compared (both images and their differences, 5
  bytes a pixel: 36 MB for 3000 x 2400) in the image diff worker, so a new tolerance only renders the heatmap again;
  the pair goes as its viewer unmounts (`forgetComparedImages`). The bitmaps cross to the worker copied, not
  transferred: `rasterize` keeps them for the pixel inspector. A window that leaves a workspace forgets the contents
  its diffs read, revisions and its own files alike (`forgetPlace`, ARCHITECTURE.md "Windows"). Measured on a
  changeset of big texts and 2400 x 2400 images, each in Differences: leaving the diff took the worker's buffers from
  30 MB to none, and switching the window to another workspace its query cache from 181 MB to none and the
  renderer's footprint from about 600 MB to 394.

What a diff read stays after it goes off screen: a revision's content is immutable, kept an hour after its last use
(`REVISION_CACHE_MS`), and of those the last 100 (`MAX_UNUSED_IMMUTABLE`) holding at most 256 MB of files
(`MAX_UNUSED_IMMUTABLE_BYTES`, `boundUnusedQueries` by `heldContentBytes`): a diff's pair and its two files hold the
same objects, counted once, and what a query on screen holds counts for nothing. By number alone, stepping through a
changeset of big models kept every one of them (a 3D model is read up to 100 MB, its parsed model about as much
again, kept as long as its bytes). A query's function is built outside the hook that asks it (`contentQueries`):
TanStack keeps it with the cached query, and one made inside the model diff's hooks kept their whole scope, both
versions' bytes and parsed models, alive with it.
