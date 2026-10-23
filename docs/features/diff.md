# Diffs

Everything a text or image diff does (`features/diff`, `features/review`), whichever view shows it. 3D models have
their own doc: `model-diff.md`.

A side of any diff that the workspace holds unchanged (the side before of the newest change of a file, the side after
of a changeset the workspace is on) is read from its disk, not downloaded: ARCHITECTURE.md "Server budget",
"Revisions on disk".

## The diff's header

Over a changeset's or a shelve's files (`TargetDiff`: from Changesets, Shelves, the Branch Explorer, a branch diff's
"By changeset"), the header says who, when and why (`ChangesetSummary`, `ShelveSummary`). A long comment is folded as a
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

## Reverting a file

A file a changeset's diff changed (the diff page, a details panel's changed files: a changeset's, a label's, a code
review's of a changeset) or a range of changesets changed has "Revert file to before this change…" in its menu
(`revertFromDiffEntry`): the file goes back to the diff's older side as a pending change, `history.revertTo` (`cm
revert <file>#cs:N`) with History's confirmation, which names the changeset it goes back to and, for a changeset's
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

## Moving through changes

Every text diff of two versions steps through its changes (`useChangeNavigation`: the
regions of the one `lineDiff`, so they follow what's typed) with ⌥↓ ⌥↑, F7 ⇧F7 (the editor keeps ⌥↓ ⌥↑ to move lines
while typing) and the header's arrows around "3 of 12" (last in the header, so ▼ stays put from file to file), from the diff or the list beside it; the first move goes from
the top of the view. The change comes a few rows from the top unless it's all in view (`scrollToChange`: a big diff
not rendered there yet is scrolled to where Pierre lays it out, `pierreLinePosition`; collapsed lines never hide one,
as changes are always in the hunks shown), lights up for a moment and, where discards are, is picked for ⌥⌘Z. Past
the last or first change, a diff beside a list of files (a diff page, Changes: `FileStepsContext`) goes on to the next
file's first change or the previous file's last, asking about unsaved edits first. A diff opened any other way
(picked in a list, from a link, on a page) opens with its first change in view, a few rows from the top unless it
starts in view already (a collapsed diff's first hunk, whose bar stays above it: `ChangeScroll`), not lit nor counted
until the first move goes to it (`openingStep`, `ChangeView.show`); one opened on a link's lines stays on them. It
opens so once, as the diff first shows: changes typed or read later leave the view where it is. A version shown alone (an added
or deleted file) is one change, "1 of 1"; a file with none to step through (an image, a binary, identical versions)
keeps the arrows, "No changes", so stepping through the list never stops there. It steps through the files as the list
shows them: in a tree, those in a closed folder are skipped. The list itself, its order and its List/Tree layout, are
every list of changed files' (ARCHITECTURE.md "Lists of changed files"); a folder selected in it shows how many changes
it holds instead of a diff. The stepping itself (the position, the keys, the arrival from a file beside it) is
`useStepNavigation`, given the steps and a `StepView`: `useChangeNavigation` is it over a diff's change regions, and the
merge page steps through conflicts with it (merge.md "Stepping through conflicts").

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
- The label's other button, "Compare moved code", opens the two places side by side (`openMovedCodeDialog`, of
  `movedCopies`): a read-only diff of what moved with what it became, in the diff's look, layout and comparison
  method, so only what changed on the way shows as changed. Code moved as it was, or with only what the method ignores
  changed, shows alone, its note saying so ("Moved without changes", "Only whitespace differs"): a diff with no line
  changes has no lines for Pierre to show (`movedComparison`). Its lines are numbered from the start of the moved code
  (Pierre numbers a diff from 1); the title says where both places are. Putting the two places side by side in the
  diff itself, each side scrolling on its own, was rejected: everything in the diff (its gaps, navigation, discards,
  the editor, the labels) relies on both sides' rows lining up.
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
patches the places Pierre 1.6.1 doesn't (a keystroke's shortcut takes lines equal only when they're the same
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

Each place the viewer reaches into Pierre (1.6.1) or `diff` past their public API is one module named for it. Those
that patch or read internals have a test that fails when an update moves them, and a method they wrap hands Pierre's
own every argument past the ones it reads (`pierreWrappedArguments.test.ts`), as Pierre adds some:

- `pierreDom`: where Pierre renders (the `diffs-container` shadow root, its rows' `data-line-type`, `data-line` and
  `data-column-number`), the gutter button slot moved to the hovered line, and hovering anew under a still pointer.
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
- `pierreLinePosition`: where a line not rendered yet sits, to scroll to a change (see Moving through changes).
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
  its diffs read, revisions and its own files alike (`forgetWorkspace`, ARCHITECTURE.md "Windows"). Measured on a
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
