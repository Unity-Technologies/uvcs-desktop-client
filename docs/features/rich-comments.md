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
  | `uvcs://…` | what the link opens (docs/features/deep-links.md) |
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
  in a full comment, its summary (the comment's first line, a review's title). Its tooltip says what it is in words
  ("Changeset 4207: Fix the switch", `chipTip`). A click opens it as its link would (`openReference` → `openLink`):
  in this window when it shows that repository, else in the one that does; a repository named without its server is
  on the place's (`referenceRepository`). In a row or a title a chip is no tab stop: the row's keys reach its object.
- A **person** is their avatar and name; an **emoji** is itself, its name in the tooltip.
- Inside something clicked as a whole (a button, a picker's option: Incoming's list, the branch search, My shelves,
  the changeset picker) a chip reads the same but is no link (`interactive={false}`), so the click stays the row's.

## What a chip reads

Nothing: a chip shows its object's summary only once one of the place's lists the window already read holds it
(`useCachedSummary`, `summaryIn`): the palette's lists, the views' lists. It looks through the cached lists of the
place's area (`queryKeys.inPlace(place, 'changesets' | 'branches' | 'labels' | 'shelves' | 'codeReviews')`), each
indexed once (a lookup walks no list), and wakes only when its area's data changes. An object read alone is left
out: an xlinked repository's changeset is cached in the place's area by its id too. A comment naming fifty
changesets costs the server nothing (CLAUDE.md, "`cm` economy"). Objects of another repository show without a
summary.

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

The Branch Explorer's caption card lays its first line over the canvas's, so both draw `summaryOf`'s text.

## Copying

Copying from a shown comment gives back what was written where it shows something else (`copyAsSource`): a chip its
spec, a person their `@name`, an emoji its `:name:`, an image its Markdown. "Copy comment" copies the stored text.

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
