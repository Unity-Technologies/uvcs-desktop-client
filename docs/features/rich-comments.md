# Rich comments

Comments (changesets, branches, labels, shelves, attributes, code review titles) are Markdown as GitHub writes it,
and name what they talk about the way `cm` does: `cs:4207`, `br:/main/task`. The app shows both: formatting, and a
chip for each object, person and emoji, that opens the object. What a comment stores is always the plain text the
person typed, so every other client (`cm log`, the official desktop client, the Unity plugin, the web) reads it as
before.

## What a comment holds

- **Markdown**: CommonMark with GitHub's extensions (tables, task lists, strikethrough, bare links, footnotes), read
  by micromark (`parseMarkdown` in `lib/markdown.ts`, the one Markdown reader the app has: release notes and attribute
  values use it too). Raw HTML reads as the text it is, but for `<kbd>`, which shows a key as a keycap, as on GitHub
  (`<kbd>Ctrl</kbd>+<kbd>F</kbd>`); links open only to `http(s):` (in the browser) and `uvcs:`
  (in the app), anything else shows its text, a bare email address too (`openExternal` opens web pages only); images
  only from `http(s):`.
- **Line breaks are kept** in a comment (`parseMarkdown(…, { comment: true })`), as GitHub shows comments: plain
  multi-line comments, the most common kind, read as they were written. Release notes and attribute values join a
  paragraph's lines, as CommonMark does.
- **References** (`findReferences`, `lib/comments/commentReferences.ts`), read in the comment as written, before
  Markdown reads it, so what Markdown would read in one never splits it (a server's host as a bare mail link,
  `__init__` as emphasis): each stands behind a placeholder while micromark reads the rest (`withPlaceholders`).
  None is read inside code, raw HTML, an image or a link, a bare web address included (`?BRANCH=br:/main` stays in
  its address: `writtenRanges`):

  | Written | Names |
  | --- | --- |
  | `cs:4207` | a changeset |
  | `br:/main/task` (or `br:main/task`) | a branch (`cm` adds the leading `/`) |
  | `lb:v1.4.0` | a label |
  | `sh:12` | a shelve |
  | `cr:311` | a code review (or merge request) |
  | `serverpath:/src/a.cs#cs:12` | a file at a changeset, branch, label or shelve |
  | any of the above `@game@acme@unity`, `@game` | the object in another repository (on the place's server) |
  | `uvcs://…`, or the official client's `plastic://…` (`isAppLink`) | what the link opens (docs/features/deep-links.md), its text kept as written |
  | `@ana`, `@ACME\tom`, `@ana@acme.com`, `@josé` | a person, as `cm` names owners, in any script |
  | `:tada:` | an emoji, by GitHub's names (`gemoji`) |

  The prefixes are `cm`'s own, read as `cm` reads them: lower case only (`CS:12` isn't one), the body up to the
  first `@`, then the repository with `rep:` and `repserver:` dropped. `cm` has no spec for a code
  review, so `cr:` is the app's, chosen to read like the others (`#311` was rejected: the palette's `#` means
  changesets). `cm` has no end-of-token rule either (it takes one argument), so a comment's sentence punctuation and
  emphasis marks (`see cs:12.`, `(br:/main)`, `**cs:12**`) are left out of the reference (`TRAILING_PUNCTUATION`). A
  reference starts only after a space, a line's start, a bracket or an emphasis mark: `ana@acme.com`, `/a/cs:1`,
  `10:30:00` hold none.
- **Names with spaces**: branch, label and repository names may hold spaces, which `cm`'s specs can't quote. Such an
  object (or one whose name ends in a punctuation or emphasis mark) is written as its `uvcs://` link, which
  percent-encodes it and shows as the same chip.

## How references show (`chipContent`, `ReferenceChip`)

- An **object** is a chip: its icon, its own name or number (`task-2210`, `4207`), the repository when it isn't the
  place's (an object of the place's repository reads as its own however it's written: `cs:12@game`, its link), and,
  in a full comment, its summary (the comment's first line, a review's title), set apart by a little space and a
  muted weight, no dot between; read aloud as "Changeset 4207, Fix the switch" (`chipName`). On hover, or keyboard focus, it shows
  the Branch Explorer's card (`HoverCard` through `ChipHoverCard`, from `chipCard`): the comment drawn as a comment's
  line, then "Changeset 4207 · Ana Diaz · 2 hours ago" (a review's status too). An object of the place's
  repository shows only what the window already read, with no command, however it's written (`cs:12@game` reads as
  `cs:12`). Another repository's changeset or label is read as "What a chip reads" says. Nothing read yet, the card
  says what it is ("Changeset 4207"). The card, as an image's preview, is placed by its chip
  (`AnchoredCard`, `hoverCardPosition`) the way the app's tooltips are, never as a popover layer: it takes no keys or
  focus, so Esc still closes a dialog while a card shows (a popover's layer took it; checked by hand in a dialog, as
  no test reaches the layers). A click opens it as its link would (`openReference` → `openLink`):
  in this window when it shows that repository, else in the one that does; a repository named without its server is
  on the place's (`referenceRepository`). In a row or a title a chip is no tab stop: the row's keys reach its object.
- A **person** is their avatar and name, their card the name `cm` knows them by; an **emoji** is itself, its name in
  the tooltip.
- Inside something clicked as a whole (a button, a picker's option: Incoming's list, the branch search, My shelves,
  the changeset picker) a chip reads the same but is no link (`interactive={false}`), so the click stays the row's.

## What a chip reads

- **An object of the place's repository** reads nothing: the chip shows its summary once one of the place's lists
  the window already read holds it (`useCachedObject`, `summaryIn`): the palette's lists, the views' lists. It looks
  through the cached lists of the place's area (`queryKeys.inPlace(place, 'changesets' | 'branches' | 'labels' |
  'shelves' | 'codeReviews')`), each indexed once (a lookup walks no list), and wakes only when its area's data
  changes. An object read alone is left out: an xlinked repository's changeset is cached in the place's area by its id
  too; only a changeset read by its number in the place's own repository counts (`changesetKey` with no other
  repository: a number typed in a comment). A spec naming the place's repository (`cs:12@game`, its link) is one of
  its own. A comment naming fifty of them costs the server nothing (CLAUDE.md, "`cm` economy").
- **A changeset or a label of another repository on the place's server** (an xlinked one, another of the same
  organization) is read by the comment shown in full around it, once what it shows stayed put for
  `SELECTION_SETTLE_MS` (`ResolvedReferences`, `useKeySettled`), so the rows an arrow passes, and a glance, read
  nothing; its first `MAX_RESOLVED_PER_COMMENT` (10) such objects, the rest as their cards open. The comments shown
  in full (`<Markdown comment>`) are the details panels' (changeset, branch, label, shelve, a review's description and
  comments, through `FoldedComment` and `SummaryComment`), History's revision header (`RevisionHeader`), Annotate's
  card (`AnnotationCard`) and the Branch Explorer's tooltip (`GraphTooltip`). Any chip, a row's or a comment's (History,
  the lists, Incoming, the palette, notifications), reads only while its card is open (`chipRead`), never as it
  draws: `remoteReadRules.test.ts` keeps reads to those two doors.
- **One on another server** is read only if the user already works with that server (one of their profiles, Settings ›
  Accounts: `knownServersQuery`, `accounts.list`'s, wildcards kept; `knownServersFrom` adds this computer's), and
  then only
  while its chip's card is open, on hover or keyboard focus, never as a comment shows (`serverReads`). A server the
  user doesn't use is never read, not even with the card open: for a server it has no profile for, `cm` doesn't
  fail but signs in there with the user's own credentials, and a comment can name any server. Its card says where it
  is instead ("In art on build.example.com:8087, not a server you use"), with nothing to read it. A read runs in a
  `cm` process of its own that is killed after `OWN_PROCESS_READ_TIMEOUT_MS` (`readOneObject`, `OneObjectRead`'s
  `ownProcess`), so a host that never answers holds no pooled session; the command log shows it. Coming back to the
  window or online asks nothing again (`refetchOnWindowFocus`, `refetchOnReconnect` off).
  A `*@cloud` profile covers the servers named `x@cloud` (`serverKind`'s `cloudOrganization`): `cm` reaches them on
  Unity's own cloud hosts, so the token never goes to a third party. A Unity organization (`x@unity`) and a regional
  cloud (`123@cloud.cn`) need a profile of their own. Narrowing it to the user's own organizations would take a list
  of them, which nothing reads yet.
- Each read is one `cm find` for that object, through the service that reads it (`changesets.find`, `labels.get`,
  the repository as the place, `remoteObjectOf`, `remoteObjectQuery`), never one for several: `cm find` has no `in
  (…)` and OR-ed ids are refused (`noOredIdLookups.test.ts`). A name a command line can't quote (a quote, a space, a
  control character) reads nothing. An object read, or an answer that the repository has none, is kept for the
  window's life ("No changeset 1201 in art" on the card); a failure (no access, a server out of reach) for
  `UNREADABLE_RETRY_MS`, five minutes, then asked again ("Couldn't read it from art", no access or out of reach). The chip keeps "1201 art"
  either way. Kept as immutable though comments can be edited: a chip's summary of another repository's object is a
  reminder of what it points at, and the object's own page reads it fresh.
- A branch (two finds, its hidden ones apart), a shelve (no read of one) and a code review (its target's name read
  too) of another repository aren't read.

## Where comments show

A comment reads as a heading (`commentHeading`), one decision for every header and row: its first line the title,
the rest the description; a list's or a quote's first line keeps its marker (`• Tidied the README`,
`3. Fix the build`) and the rest of the list follows it, so nothing shows twice. One that opens with code or a table
has no title, as its first line alone would cut the block, which shows whole; a rule it opens with is skipped. As one
line (`commentLineInlines`) it is the title, or that block's first line (code's first line, a table's header). Only
the opening block is read for it (up to the first blank line), so a row costs what its comment's first paragraph
does.

| Where | How |
| --- | --- |
| Details panels (`DetailsHeading` → `FoldedComment`), a diff's header (`SummaryComment`), History's revision (`RevisionHeader`), the annotate card, the Branch Explorer's caption card | The whole comment: the title as a line (`CommentLine`), the description as Markdown (`Markdown` with `comment`) |
| Every list (changesets, branches, labels, shelves, attributes, code reviews, History, Incoming, the changeset picker, the branch search, My shelves, a check-in's rejection) | The first line: inline formatting, compact chips, emoji, links as their text, images by their description (`CommentLine`); the filter's words marked |
| What holds only text: the Branch Explorer's canvas, its tooltips, the palette's rows (reviews' titles too), notifications, the branch pill, the comparison title | Without marks (`commentLineText`, `commentText`): references as written, emoji as themselves; a line with nothing Markdown could read skips the parsing (the canvas asks for thousands) |

The Branch Explorer's caption card lays its first line over the canvas's: the canvas draws its text (`summaryOf`), the
card the same line as a row does (`CommentLine`), its references as chips. A long comment's card stops at the
canvas's bottom (`captionCardMaxHeight`), above the status bar, and its body scrolls, the wheel over it its own and
not the graph's (`wheelGoesTo`; a zoom still zooms the graph); a card opening within a few
lines of that bottom keeps a few lines' height (`CARD_MIN_HEIGHT`) and can reach under the status bar, as the pointer can reach it; no line clamp, which cut
Markdown's blocks.

## Copying

Copying from a shown comment (`copyAsSource`, `copiedText`) has one rule for the whole and one for a part:

- **The whole comment** selected (a drag over its title and description in a details panel or over a diff,
  `FoldedComment`'s `comment`; spaces and line breaks aside) gives it back exactly as written, its marks, list markers
  and code fences included, as "Copy comment" does. Its description selected whole gives the description as written.
- **A part** gives what it reads, its lines kept, with what was written wherever it shows something else: a chip its
  spec, a person their `@name`, an emoji its `:name:`, an image its Markdown. Its marks (`**`, `-`, fences) aren't
  rebuilt: the page can't say where a part starts in the source. A comment's line in a row or a title shows its title
  only, so a copy from it is always a part's.

## Images

An image (`![alt](https://…)`) shows as a chip with its description; on hover its picture shows, fetched from its
host only then, with no referrer (`CommentImage`); a click opens it in the browser. The page's
Content-Security-Policy allows `https:` images for this (ARCHITECTURE.md, "What leaves the device").

## Code

A fenced block is highlighted in its fence's language (`CodeBlock`, `highlightedLanguage`) by the highlighter the
diffs share (Pierre's Shiki, `getSharedHighlighter`), in the theme the app shows (`pierreThemeName`), in comments and
everywhere else `Markdown` renders (release notes, attribute values, the Branch Explorer's caption card).
`HighlightedCodeBlock` loads on the first block with a language, never at start-up. The highlighter runs on the page's
thread, so a block past `MAX_HIGHLIGHTED_COMMENT_CHARS` (20,000 characters, the diffs' own limit there) shows plain,
and no line is tokenized past 1,000 characters. Each block is tokenized once per theme (the last 50 kept). Until its
grammar loads, for a language the highlighter doesn't know, and for a block too big, it shows plain in the same box,
so nothing moves as colors arrive; switching themes keeps the old colors until the new ones are in.

## Writing

Every comment field writes a comment the same way (`CommentField`, `components/commentEditor/`): the check-in and
shelve composer (`CheckinPanel`: its summary and description), the details panels' editor (`CommentEditor`, through
`DetailsHeading`: changesets, branches, labels, attribute types), Edit comment (`EditCommentDialog`, a changeset's or a shelve's), New branch,
New label and New attribute (`CommentArea`: a press on its label puts the caret in the editor, which a `<label
htmlFor>` can't focus, and the label names it, `fieldLabelAttributes`), the comment of a merge into a server branch (`MergeHeader`) and a new code review's title
(`CreateCodeReviewDialog`). Comments asked for with `prompt()` (a changelist's, an attribute's) stay plain fields.

A changeset's or a shelve's comment is edited as the check-in writes it, a title and a description: Edit comment and the details
panels' editor open it in its parts (`editingParts`: its title and the rest when it has one; whole in the description
when it opens with a list, a table or code, or is empty, so nothing moves into the title) and write them back as the
check-in joins them (`editedComment`): unchanged, the comment is written back as it was, so saving with no edit
writes nothing (the dialog's Save stays disabled); with one part edited, the other keeps its text and the comment
keeps the line ends it had after its title, so a "title, line end, body" comment never gains a blank line; a title
given to a comment that had none is set off by a blank line. Edit comment's two fields are one focus mode
(`CommentFocusGroup`, the check-in's panel over the dialog), ↓ and ↑ go between them, Enter from the title to the
description; it has no Recent comments (they're for a check-in, not a changeset already made). Leaving it edited (Esc,
Cancel, a click outside) asks first ("Discard your changes to this comment?", `hasUnsavedEdit`); unedited, it closes.
A changeset's details panel edits it the same way, its title and description one focus mode too, its Save disabled
until an edit; left edited for another row, it keeps the
draft and opens with it on coming back (`commentEditorExit`, `useCommentDraftStore`, `DetailsHeading`'s `draftKey`),
as a question there would hold the list's selection hostage.
A recent comment picked in the check-in opens in the same parts (`recentCommentPick`), and the caret goes to the
end of the field that took its text. New branch, New label and New attribute stay one field: theirs is a
description, not a commit message, as are a branch's, a label's and an attribute's in their details panels.

- **The text is the comment.** The editor is CodeMirror 6 over the comment's own Markdown, drawn as it reads: what a
  field gives and takes is the stored text, LF line ends as `cm` keeps them, never converted, so saving, undo and
  copying need nothing and what the user didn't touch is never rewritten. A rich-text editor (Tiptap/ProseMirror)
  was tried and rejected: writing its tree back as Markdown rewrote people's comments (`[url](url)` for a bare link,
  a list split in two, `_` escaped).
- **Drawn as it reads around the caret** (`liveMarksOf`): Markdown's marks (`**`, `` ` ``, `~~`, `# `, a link's
  brackets and address) show only for the construct the caret is in; the rest of the line stays drawn. A selection
reveals only where it started (`selectionReveals`: its anchor, which the press or the caret had shown already) and
keeps drawn whatever it grows over, so a drag never reflows the text under the pointer; the widgets it covers (chips,
images, boxes, bullets, a table) show as selected (`selectionCovers`), and copying or cutting still takes the source. A list's `-`
  is a bullet, a task's `[ ]` a checkbox a click ticks (`toggleTask`), quotes and code blocks show as blocks, a code
  block's fences dimmed and its code colored by the comments' own highlighter (`codeColors`: Pierre's Shiki, as
  `CodeBlock`, the same size limit and line length: a block past `MAX_HIGHLIGHTED_COMMENT_CHARS` stays plain; only the
  block being edited is tokenized again at a key; while typing, the colors drawn move with the text, `mapMarks`, and
stay until the block's new ones replace them in one step once typing pauses, `codeColorsAfter`, `colorArrival`: code
never shows without its colors as it's typed). A key (`<kbd>Ctrl</kbd>`) is its keycap, its tags showing with the caret in it. A table the caret isn't in is drawn as a table (`tableModel`; a click on a cell puts the caret at its
  end; ↓ or ↑ from the line next to it lands on its first or last line, where the editor, moving by what it shows,
  would step over it: `verticalMoveInto`, Shift extending the selection). Tables are the only block drawn in place
  of their source: rules and fences show as typed. An image is its chip. A field without the focus draws everything.
- **References are the comments' chips** (`ReferenceChip`, with their summary as a shown comment has it, as soon as
  the window read it: a list, or the number looked up as typed; compact on one line, the summary in its card), for
  every kind a comment reads (`findReferences`). The chip the caret reaches, by an arrow or typing it, shows as its
  text to edit, as Markdown's marks show around the caret; the others stay drawn. A click selects a chip's text,
  shown as typed, so typing replaces it (`selectChip`). Backspace right after a chip takes back its last letter, as
  in any text it shows as: a chip taken away whole by one key (Slack's way) was dropped, since the caret beside a
  chip always shows its text, and a key taking away more than it shows would surprise. Undo brings a chip back.
  A chip is React in the box CodeMirror gives it (`WidgetPortals`, drawn by `WidgetPortalsView`). CodeMirror draws
  boxes inside whatever asks it to measure, a component's render among them, so the portals are told after that work
  (a microtask), never during it. The portals are drawn by a memoized component of their own, which re-renders only
  as widgets come and go (`WidgetPortals` keeps the same list otherwise), never on a key: rendering every chip's
  portal at each key made a comment of hundreds of chips slow to type. A chip's DOM is kept as its line redraws
  (`ReferenceWidget.eq`), and a guard test counts that a key changes only its line's decorations (`liveDecorationsOf`).
- **Keys** (the registry's Comments area, matched as every shortcut is: `formatForKey`): ⌘B bold, ⌘I italic, ⇧⌘X
  strikethrough, ⌘E code, ⌘K link, ⇧⌘8 list, ⇧⌘7 numbered list, ⇧⌘9 quote, ⌥⇧⌘C code block (Ctrl+Shift+E off macOS, where Ctrl+Alt is
  AltGr), ⇧⌘V (Ctrl+Shift+V) pastes the plain text, through the window (`pasteClipboard({ plainText })`,
  `pasteAndMatchStyle`), as no menu item takes the key and the page can't paste by itself. Each toggles (`FORMAT_COMMANDS`: ⌘B in bold unbolds) and is one step to undo
  (`ownStep`), as are a pick, a paste and a box ticked. A key the field takes stays in it: ⌘B
  never opens New branch from a comment, nor ⌘K the palette (⇧⌘P still does). Typed Markdown works as typed; Enter
  continues a list, and Enter after an opening fence adds the closing one (`closeCodeFence`). ⌘↵ saves the field's
  form (a dialog, the details editor) or is the window's (check in, merge); Esc closes the suggestions first.
- **One-line fields** (a summary, a title, the merge comment) take the inline formats only and wrap a long line;
  Enter goes on to the description (a summary) or submits (a dialog's title). A line end typed (Shift+Enter) or
  dropped becomes a space (`oneLine`). Lines pasted in a summary go on in its description (`withSummaryText`); in a
  title or the merge comment they join (`oneLineText`). The field's text follows its owner's value after every change
  that differs from it, also when the owner kept its value. A text the owner puts in whole (a recent comment picked,
  a changelist's comment) is one step to undo, back to what was written (`ownerExchange`). React renders the field
  and its owner's value together, but a key can land between a render and its effects: a value equal to what its
  render showed is the owner agreeing and is never written back, or it would take those keys away and put them back
  where the caret no longer is. Matching the texts the field sent was dropped: the owner's answer to a paste in the
  summary can equal a text sent a moment before, and was ignored for good.
- **Focus mode** (`focusMode`, `useFocusMode`): a field of many lines grows into a larger editor to write a long
  comment, by the quiet button in its corner (shown on hover or focus) or ⇧⌘F (Ctrl+Shift+F), and back the same way
  or with Esc. It is one experience everywhere (`focusModeFor`, `focusModeLayout`): a panel over the window, the
  rest dimmed (a click there goes back), the toolbar and the hints only there, every field compact until it opens.
  From a dialog it lies above the dialog: the backdrop goes in the dialog (`backdropParent`), so a click on it closes
  the panel and never the dialog, Esc closes the panel first, then the dialog, and ⌘↵ leaves the panel and submits;
  the dialog's centering gives way while it's open (`Dialog.module.css`). Growing a dialog's field in place was
  dropped: the dialog grew too tall, or its field barely grew, by how much room its other fields left. It is the same
  editor, never a copy: the text, the caret, the selection and the undo history stay; on a field with text never
  focused yet, it opens with the caret at the end (`caretOpeningFocusMode`). It closes as ⌘↵ saves or checks
  in, and as the focus leaves the editor (`layoutAfterFocus`: a question the check-in asks, Tab), and it lies under
  the dialogs it opens (z 790): a question it raises never shows behind it, nor does Tab walk the dimmed view. Its
  entry points: the check-in's summary (⇧⌘F) and description, Edit comment, a details panel's editor (a changeset's
  title and description; a branch's, label's or attribute's description), New branch, New label and New attribute.
  A merge's comment and a code review's title are one line and have none. A popup
  editor holding a copy of the text was dropped: two editors of one comment would have to be kept in step, and its
  undo, caret and suggestions would start over.
  In the check-in, focus mode opens the summary and the description together (`CommentFocusGroup`,
  `focusModeFields`): one panel, the summary a title over the description, the caret staying where it was. Tab, or
  ↓ at the summary's end, goes to the description's start; ↑ on its first line back to the summary's end
  (`groupMove`). They stay the same two editors; moving between them is no leaving, and the panel closes as the focus
  leaves both or ⌘↵ checks in. The dialogs' single comments open alone.
  In focus mode Tab is the text's (`focusModeParts`' `takesTab`, `indentLines`, `outdentLines`): it nests a list item
  under the one above by its marker's width (a task keeps its box), as GitHub and Obsidian do, and indents a code
  block's line by the block's own indent (a tab, or the spaces its first indented line has), four spaces in a block
  with none; a paragraph's line is left alone, as four spaces would make it a code block. ⇧Tab takes it back, each
  line of a selection by its own kind. Esc leaves focus mode, and out of it Tab leaves the field as in any form, Esc
  then Tab too (CodeMirror's tab focus mode, turned off as focus mode opens so a recent Esc can't skip its keys).
  In focus mode a comment of many lines has a toolbar as its box's top strip (`FormatToolbar`, `toolbarButtons`), as
  GitHub's, and its hints right under the box as its caption (`FocusModeFooter`, `KeyHints`' `caption`). The toolbar
  holds every format of `FORMAT_ACTIONS`, the one list the selection bar and the keys read too (Lucide's icons, but
  strikethrough's, `StrikethroughIcon`: an S centered like the B and the I beside it), each tooltip its name and key, pressed where the caret's text has it; its buttons never take the focus, and the corner button back to
  the field sits at the strip's end. It formats its own field only: in the check-in that is the description, its
  buttons disabled while the caret is in the summary, whose formats are its keys; in code only the code block is
  enabled. The text then takes the box's whole width, a code block the same inset on both sides. The hints are the
  window's key hints, each key a cap as the palette and the shortcuts sheet draw them (`Kbd`): `cs:` `br:` `lb:`
  `sh:` `cr:` reference, `@` mention, `:` emoji, read from the triggers the suggestions take
  (`focusModeHints`, `SUGGESTION_TRIGGERS`). ⌘K is the link button's tooltip, as every format's key is. The hints
  keep one line: where it's too narrow the last ones go (`KeyHints`' `oneLine`, `hintsThatFit`), never wrapping. A table and a keycap have no button: no single construct of the
  Markdown reader holds a key's `<kbd>` tags to toggle, and an empty table is more text to fill in than to type.
- **The selection bar** (`SelectionBar`, `selectionBarShows`): over text selected, once the pointer lets go, never in
  a code block nor in focus mode, which has its toolbar; B, I, S, code and link, then list, task, numbered list, quote
  and code block in a field of many lines, each on while the selection is in it. No toolbar shows otherwise: the
  fields stay small.
- **Pasting** (`markdownFromClipboard`): HTML from a web page, Slack or Google Docs becomes Markdown (bold, italic,
  strikethrough, links, lists, tables, images from the web), Docs' bold-looking `<b id="docs-internal-guid-…">`
  unwrapped and its styled spans read, Word's and Outlook's markup left out; scripts and styles go, and a link stays
  only to what a comment opens (`http(s):`, `uvcs:`), any other keeping its text; code from an editor (monospace, preformatted) becomes a code block in the
  language VS Code names, on a line of its own (`pasteMarkdown`). A copy with nothing its plain text doesn't hold
  pastes as it is; in code nothing converts; an address pasted on selected text links it (`linkFromPaste`).
- **Stored as written**: a dialog's comment goes in without the blank lines at its ends or the space a picked
  suggestion leaves (`storedComment`), its first line's indent kept, as an indented code block needs it.
- **Placeholders** say only what a field is for ("Description (optional)", "Summary"); an empty comment in focus
  mode says "Write in Markdown" (`placeholderShown`, `FOCUS_MODE_PLACEHOLDER`), its hints under it naming the triggers.
- **Loading**: CodeMirror is a heavy library (`HEAVY_SCOPES` in `startupBundle.test.ts`), loaded behind
  `CommentField`'s lazy boundary and warmed at idle after start-up (`main.tsx`). Until it arrives, a plain field in
  the same box takes the typing and hands its caret over.

### Suggestions

What the list depends on, each with one owner (`suggestionGate` decides; the editor only feeds it):

- **Opens**: a trigger typed at the caret (`suggestionQueryAt`) while the word is being typed (`typingAt`, the
  editor's state: set by a key typed or a Backspace taking back what was typed, cleared by any other edit or caret
  move, and by the field losing the focus, so Enter from the summary or a click back opens no list on a word typed
  before), in a field with the focus. The focus is the DOM's (`editorFocused`, `fieldFocused`); the state's mirror of it
  (`hasFocus`, `editorFocus`) is for the decorations alone and has one writer, `watchFocus`, which sets it from the
  DOM on the field's `focusin` and `focusout`, on its window's `focus` and `blur` (the window active again moves no
  element's focus), and after any update where they differ; CodeMirror's `focusChangeEffect` doesn't write it. Code
  focuses an editor only through `focusEditor`. `editorFocusRules.test.ts` keeps the rules: a mirror left behind as
  focus mode opened by its button once hid the list for good, and one that missed the window coming back drew a
  focused field as unfocused, its list closed.
- **Closes**: Esc, a pick, the caret leaving the word, the focus leaving the field, a list with no row (emoji with no
  match). A pick leaves the reference drawn as its chip until the next edit or caret move (`justPicked`).
- **Stays closed**: on the word Esc closed it on (`dismissedAt`, the word's start, held by the editor: one editor per
  field, made again with each place, so nothing carries over between places or fields), until another word is typed.
  Nothing it depends on is module-level; the lists it reads are the place's queries, keyed by the place.

Typing `cs:`, `br:`, `lb:`, `sh:`, `cr:` or `@`, or `:` and two letters of an emoji's name, after a space, a line's
start, a bracket or an emphasis mark (`suggestionQueryAt`), opens a list under the word while it's typed
(`suggestionsShownAt`), so a field opened with its caret after a reference opens none. The list is a listbox the
field's `aria-activedescendant` walks: ↑↓ move, Enter or Tab picks, Esc closes it until another word is typed
(`suggestionKeyAction`); with nothing to pick, the arrows move the caret. Enter picks the highlighted suggestion,
or a row the user moved to; it never runs "Search all changesets" the list merely starts at, so Enter after a
reference nothing matches is a line end. Another repository's object (`cs:2@art`, `namesAnotherRepository`) gets no
list at all: this repository's lists, searches and number lookup say nothing about it. A colon in a sentence (`10:30`, `Note:`)
opens nothing. A pick writes the reference as `cm` takes it and a space (`pickSuggestion`), no space before a line's end or a
sentence's punctuation, where the reference stays drawn as its chip though the caret is against it, until the next
edit or caret move (`justPicked`); a branch or label whose
name a spec can't hold (a space, a sentence's punctuation or an emphasis mark at its end) is written as its
`uvcs://` link (`objectReferenceText`), which shows as the same chip; a person as `cm` names them (`@ana@acme.com` on
Unity Cloud); an emoji as the character itself (🎉, not `:tada:`), one character to Backspace and to the caret even
when it joins several (the rainbow flag, a white flag and a rainbow joined). A `:name:` typed out whole stays as typed.

The list opens on the trigger's key, always with a row: a pick, or "Reading branches…" with a spinner (`Spinner`,
still with reduced motion), or "Couldn't read branches" when the read failed (never "No branches", which would read
as a repository with none; typing the trigger again reads again). The word typed is underlined in the chips' accent
from its trigger on (`suggestionCue`, `suggestionCueField`), pulsing gently while its list is read, so the field
shows it understood `br:` whatever the list does. The list opens under the line or over it, always inside the
window, and is placed again as its rows change size (`suggestionListPosition`, a `ResizeObserver`).

The data is sized for a repository of 20,000 branches and 280,000 changesets (`useSuggestionRows`, `listedFrom`).
Each kind reads only once its trigger is typed (`suggestionReads`), through the queries the palette and the views
share (`paletteQueries`): every branch (`everyBranchQuery`), every label (`everyLabelQuery`), the last three months'
shelves (`recentShelvesQuery`), the newest reviews (`reviewSummariesQuery`). Until every branch or label is read
(seconds, on a repository of 20,000 branches), the server searches what is typed once typing settles (`branchSearchQuery`,
`labelSearchQuery`: one `cm find … like … limit 50` per settled text, the palette's own search and key), and its
answer shows. Changesets: the palette's newest 2,000 when already read (`recentChangesetsQuery`), else the newest 50
(`suggestedChangesetsQuery`). `br:fix-10` runs two finds, the search and then every branch; `cs:` then a number two, the newest 50 and then the number. A changeset's number they don't hold is looked up (`useChangeset`) once typing stops on it
for as long as the palette's search waits (`useDebouncedValue`, `SERVER_SEARCH_DELAY_MS`): `cs:4207` reads 4207
alone, never 4 on the way. Words they don't match offer "Search all changesets for …", the palette's on-demand search
(`useChangesetSearch`), run only when picked. People are the owners those lists hold and everyone the place's lists
showed (`peopleSeenIn`): no query lists people. Each list is read into an index once per read and ranked at each key
(`rankCandidates`: the name typed, then names starting with it, then names holding it, then comments), the best
eight shown.

## Checking it on screen

The flows that broke before, as steps to follow in a development build (StrictMode) against
`scripts/sandboxes/rich-comments.sh`, and for the big-repository ones a large repository, reads only. Each is
checked in both themes when it draws something.

1. **Focus mode by its button after a workspace switch.** In the check-in, type `cs:` and pick; open focus mode,
   type `cs:` and pick; close it. Switch to another workspace and back. Without clicking or typing in the
   description, press its "Write in a larger editor" button and type `cs:`: the list shows.
2. **Suggestions at the window's bottom.** Write a description longer than its box, the caret on its last line at
   the window's bottom; type `cs:` and `br:`: the list shows whole, over the line.
3. **A big repository's first trigger.** Open it, go to Changes at once and type `br:` and a few letters in the
   description: "Reading branches…" with a spinner on the key, then branches; the command log shows one search and
   one read of every branch.
4. **Selecting by drag over widgets.** With chips, an emoji, a keycap, a table, an image and code in a comment, drag
   from the bottom up: nothing moves; the widgets covered show as selected; ⌘C gives the source.
5. **Typing fast in code.** In a ```` ```ts ```` block, type a line fast: the colors already there stay, no key is lost.
6. **The format bar's buttons.** Select a word in a small field and click each button of the bar: each formats.
7. **A pick at a line's end.** With a line below, type each trigger (`cs:`, `br:`, `lb:`, `sh:`, `cr:`, `@`) and pick:
   each shows as its chip at once.
8. **Tab in focus mode.** In a list, Tab nests an item and ⇧Tab takes it back; in code Tab indents; in a paragraph it
   does nothing; in the check-in's summary Tab goes to the description.
9. **Edit comment's shapes.** On a comment with a title, one opening with a list, one with a table, a single line,
   and a title and body with no blank line: the fields open as `editingParts` says and Save stays disabled until an
   edit.
10. **Esc in a dialog with a chip's card open.** In Edit comment, hover a chip until its card shows, press Esc: the
    dialog closes.
11. **A confirm opened from focus mode.** With a change pending, open the check-in's focus mode and press ⌘↵ where the
    check-in asks something: the question shows over focus mode, which closed.
12. **Another server's chips.** Hover a chip of a repository on a server you use: its card reads it once (the command
    log). Hover one on a server you don't: its card says "In … on …, not a server you use" and the log shows nothing.
13. **Typing fast with a list open.** In the description, type `cs:` so the list shows, then type a sentence as fast
    as keys go (a script's `keyboard.type` with no delay): every key lands, in order.
14. **A long comment of chips.** Paste 150 lines of three references each in focus mode and type at the first line's
    start: each key shows at once (the profiler: under 16 ms a key in a production build).
15. **Focus mode by its button on a field with text.** Pick a recent comment, switch views and back, and press the
    description's "Write in a larger editor" without clicking in it: the caret is at the text's end.
16. **Leaving Edit comment edited.** Edit a comment and press Esc, then Cancel: each asks to discard; with no edit,
    each closes at once.
17. **The larger editor from every entry point.** From the check-in's summary (⇧⌘F) and description, Edit comment,
    a changeset's and a branch's details panel, New branch, New label and New attribute: compact until it opens, then
    the same panel over the window with its toolbar and hints, a changeset's as a title over its description. From a
    dialog: a click on the dimmed rest closes the panel only, Esc closes the panel then the dialog, ⌘↵ submits.
18. **A chip's number.** In a row and in a narrow card, a chip with a long summary: its id shows whole, the summary
    shortened.
19. **A recent comment that opens with a list.** Pick one: it goes whole into the description, the summary stays
    empty, and the caret waits at the description's end.
20. **The Branch Explorer's card.** Hover the caption of a changeset whose title has references and whose comment is
    longer than the window (720 px tall): the title shows its chips, the card stops above the status bar, its bottom
    edge in sight, and its body scrolls.
21. **Two editors in a development build.** With the check-in's description holding chips, open Edit comment on a
    changeset with chips: the console shows no "Cannot update a component while rendering a different component".
22. **Copying a shown comment.** In a details panel, drag over a whole comment with a list, bold and a chip, its title
    and description, and copy: the clipboard holds it as written; its description alone gives the description as
    written. Copy two list items: they read as shown, their chips as their specs.
23. **Enter after another repository's reference.** Type `see cs:2@other-repo` and press Enter twice: no list shows,
    each Enter starts a line, nothing is searched.
24. **Enter back from the summary.** In the description type `see br:`, Esc, then a title in the summary and Enter,
    Enter: the description gains a line, no branch is picked. The same with a description ending in `note cs:9`.
25. **A table of references.** Paste a 100-row table of references under a line in focus mode and type in the line:
    each key under 16 ms in a production build, no chip drawn again.
26. **A details panel's edit.** Edit a changeset's comment in its details panel: Save off until an edit; Esc and
    Cancel ask; another row and back opens the editor again with the draft.
27. **The wheel over the Branch Explorer's card.** Over a long comment's card the wheel scrolls the comment, not the
    graph; a pinch still zooms the graph.
