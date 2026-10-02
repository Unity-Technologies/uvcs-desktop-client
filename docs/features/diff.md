# Diffs

Everything a text or image diff does (`features/diff`, `features/review`), whichever view shows it.

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
scrolls sideways on its own and its bar would sit at the end of the file, so `PaneScrollbars` keeps one per pane at
the bottom of the view (diffs, the whole-file editor, merge resolution). Every text diff, and the whole-file editor, renders only the
lines in view (Pierre's `Virtualizer` on the diff's scrolling element): what's drawn again (a line added, a typing
pause's word marks, a theme switch) costs those lines, not the file's. With every line of a 190 KB file shown, the
typing pause's redraw took 0.45 s before; it's now under a frame. A file's language comes from its path
(`lib/syntaxLanguage`, for diffs, annotations and merges alike): its whole name first (Dockerfile, Cargo.lock,
.gitignore), then its longest extension (.gradle.kts before .kts), from tables of the grammars Pierre bundles (.NET
projects are XML, Unity's assets YAML, its shaders HLSL), then Pierre's own guess; a test checks every one is in
Pierre's bundle. Shiki reads whole files at once, never just the
lines in view, so `syntaxHighlighting` picks by size (both versions together), at 1.5 to 4.5 ms a KB on the main
thread: a diff up to 20 KB highlights there before it shows (about 0.1 s); up to 4 MB (400 KB if it's typed into) it
renders only the lines in view, shows as plain text at once and takes its colors from Pierre's worker
(`useHighlightWorkers`: 0.2 s for 2 x 16 KB, 1.2 s for 2 x 156 KB, 1.7 s for 2 x 190 KB of TypeScript, 12 s for
2 x 1.6 MB; one worker, in the app's theme only, see Memory), in the editor's markup (`useTokenTransformer`). A diff
typed into gets its editor once the worker's colors are in (`attachesEditor`, `isReadyToEdit`): Pierre's edit session
reuses them, where an editor attached earlier makes Pierre highlight the whole diff on the main thread (1.6 to 1.8 s
for 2 x 190 KB of TypeScript, the app frozen). A click in the text (or ⌘E) before then waits for them, keeping what's
typed meanwhile and typing it at the click once the editor is attached (`focusAt`, `typeWhileAttaching`); only a
worker that failed (`MAX_WAIT_FOR_COLORS_MS`) attaches it anyway. That main-thread fallback is why a diff typed into
goes to the worker only up to 400 KB (`MAX_HIGHLIGHTED_CHARS`). Anything bigger is plain text and renders only the
lines in view too (Pierre renders a plain text diff whole at every render: `pierrePlainTextRender` keeps it), with a
quiet "Large file" in the header (its tooltip says why); such a diff is the "text" language (`highlightedLanguage`),
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
stack for the session (⌘Z in the diff); with some, it's one more edit in the editor, unsaved, and ⌘Z takes it back
like typing (`diffDiscards`).

## Moving through changes

Every text diff of two versions steps through its changes (`useChangeNavigation`: the
regions of the one `lineDiff`, so they follow what's typed) with ⌥↓ ⌥↑, F7 ⇧F7 (the editor keeps ⌥↓ ⌥↑ to move lines
while typing) and the header's arrows around "3 of 12" (last in the header, so ▼ stays put from file to file), from the diff or the list beside it; the first move goes from
the top of the view. The change comes a few rows from the top unless it's all in view (`scrollToChange`: a big diff
not rendered there yet is scrolled to where Pierre lays it out, `pierreLinePosition`; collapsed lines never hide one,
as changes are always in the hunks shown), lights up for a moment and, where discards are, is picked for ⌥⌘Z. Past
the last or first change, a diff beside a list of files (a diff page, Changes: `FileStepsContext`) goes on to the next
file's first change or the previous file's last, asking about unsaved edits first. A version shown alone (an added
or deleted file) is one change, "1 of 1"; a file with none to step through (an image, a binary, identical versions)
keeps the arrows, "No changes", so stepping through the list never stops there.

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
patches the places Pierre 1.5.1 doesn't (its `FileDiff` never hands them to the renderer that re-diffs each
keystroke, a keystroke's shortcut takes lines equal only when they're the same text, and text typed back to the
original's shows no change), re-renders the diff whole when a keystroke leaves rows the diff doesn't have, and its
test fails when a Pierre update moves them. `pierreTyping.test.ts` types into diffs of every kind of text (line
breaks, final line breaks, whitespace, empty sides) under every method, checking after each keystroke that Pierre's
diff is `lineDiff`'s and that the rows on screen are the diff's (`pierreSessionFixture`). `cm` commands keep their own
comparison: merges don't change with it.

## Line breaks

Lines end with LF, CRLF or the lone CR of classic Mac files (`lib/lineBreaks`). Pierre and `diff`
break lines only at LF, so everything they get (diffs, the editors, conflicts, whole versions) shows each lone CR as
a LF (`shownText`), with the same lines. Everything else keeps the files' own text: the editor's text goes back to
the file's line breaks as it's typed (`diskText`: kept lines keep theirs, new ones take the file's most common),
discards and merges split lines at all three, and one side of lone CRs against one of LFs still differs under the
methods that recognize line endings (`crAgainstLf`); a file mixing both can't tell which of its LFs were CRs.

## Images

An image's bytes cross IPC as binary (`FileContent.image`, a `Uint8Array` and its type, 40 MB a side at
most) and are painted from a blob URL that lives while it's shown (`useImageUrl`), never a data URL (35 MB of text for
a 25 MB PNG, decoded again at every paint). The URL is revoked as the image changes, so what is painted is only ever
the decode of the image's current URL (`shownDecodeState`): an `<img>` still given the one before fails to load.

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

## Pierre workarounds

Each place the viewer reaches into Pierre (1.5.1) or `diff` past their public API is one module named for it. Those
that patch or read internals have a test that fails when an update moves them:

- `pierreDom`: where Pierre renders (the `diffs-container` shadow root, its rows' `data-line-type`, `data-line` and
  `data-column-number`), the gutter button slot moved to the hovered line, and hovering anew under a still pointer.
  The tests run without a page, so this one is checked on screen.
- `pierreLineComparison`: typing re-diffs under the comparison method (see Comparison method).
- `pierrePlainTextRender`: a diff shown as plain text renders once, not at every render (see Editing in the diff).
- `pierreSessionEndRefresh`: a diff typed into isn't highlighted again as it goes away (see Editing in the diff).
- `pierreWordMarks`: a diff typed into marks the changed words once typing pauses, in the rows Pierre keeps (see
  Editing in the diff).
- `pierrePlainTextWordDiffs`: a diff shown as plain text marks changed words past 1,000 lines (see Editing in the diff).
- `pierreLinePosition`: where a line not rendered yet sits, to scroll to a change (see Moving through changes).
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
