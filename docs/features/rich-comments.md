# Rich comments

Comments (changesets, branches, labels, shelves, attributes, code review titles) are Markdown as GitHub writes it,
and name what they talk about the way `cm` does: `cs:4207`, `br:/main/task`. The app shows both: formatting, and a
chip for each object, person and emoji, that opens the object. What a comment stores is always the plain text the
person typed, so every other client (`cm log`, the official desktop client, the Unity plugin, the web) reads it as
before.

## What a comment holds

- **Markdown**: CommonMark with GitHub's extensions (tables, task lists, strikethrough, bare links, footnotes), read
  by micromark (`parseMarkdown` in `lib/markdown.ts`, the one Markdown reader the app has: release notes and attribute
  values use it too). Raw HTML reads as the text it is; links open only to `http(s):`, `mailto:` and `uvcs:`, anything
  else shows its text; images only from `http(s):`.
- **Line breaks are kept** in a comment (`parseMarkdown(…, { comment: true })`), as GitHub shows comments: plain
  multi-line comments, the most common kind, read as they were written. Release notes and attribute values join a
  paragraph's lines, as CommonMark does.
- **References** (`findReferences`, `lib/comments/commentReferences.ts`), read in a comment's text, never inside code
  or a link's text:

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
  | `@ana`, `@ACME\tom`, `@ana@acme.com` | a person, as `cm` names owners |
  | `:tada:` | an emoji, by GitHub's names (`gemoji`) |

  The prefixes are `cm`'s own (`SpecGenerator` reads them the same way): lower case only (`CS:12` isn't one), the
  body up to the first `@`, then the repository with `rep:` and `repserver:` dropped. `cm` has no spec for a code
  review, so `cr:` is the app's, chosen to read like the others (`#311` was rejected: the palette's `#` means
  changesets). `cm` has no end-of-token rule either (it takes one argument), so a comment's sentence punctuation
  (`see cs:12.`, `(br:/main)`) is left out of the reference (`TRAILING_PUNCTUATION`). A reference starts only after a
  space, a line's start or a bracket: `ana@acme.com`, `/a/cs:1`, `10:30:00` hold none.
- **Names with spaces**: branch, label and repository names may hold spaces, which `cm`'s specs can't quote. Such an
  object is written as its `uvcs://` link, which percent-encodes it and shows as the same chip.

## How references show (`chipContent`, `ReferenceChip`)

- An **object** is a chip: its icon, its own name or number (`task-2210`, `4207`), the repository when it isn't the
  place's, and, in a full comment, its summary (the comment's first line, a review's title). Its tooltip says what
  it is in words ("Changeset 4207: Fix the switch"). A click opens it as its link would (`openReference` →
  `openLink`): in this window when it shows that repository, else in the one that does.
- A **person** is their avatar and name; an **emoji** is itself, its name in the tooltip.
- Inside something clicked as a whole (a button, a picker's option: Incoming's list, the branch search, My shelves,
  the changeset picker) a chip reads the same but is no link (`interactive={false}`), so the click stays the row's.

## What a chip reads

Nothing: a chip shows its object's summary only once something in the window already read it (`useCachedSummary`,
`summaryIn`): the palette's lists, the views' lists, an object read alone. It looks through the cached data of the
place's area (`queryKeys.inPlace(place, 'changesets' | 'branches' | 'labels' | 'shelves' | 'codeReviews')`) and
updates as more is read. A comment naming fifty changesets costs the server nothing (CLAUDE.md, "`cm` economy").
Objects of another repository show without a summary.

## Where comments show

| Where | How |
| --- | --- |
| Details panels (`DetailsHeading` → `FoldedComment`), a diff's header (`SummaryComment`), History's revision (`RevisionHeader`), the annotate card, the Branch Explorer's caption card | The whole comment: the title as a line (`CommentLine`), the description as Markdown (`Markdown` with `comment`) |
| Every list (changesets, branches, labels, shelves, attributes, code reviews, History, Incoming, the changeset picker, the branch search, My shelves, a check-in's rejection) | The first line: inline formatting, compact chips, emoji, links as their text, images by their description (`CommentLine`); the filter's words marked |
| What holds only text: the Branch Explorer's canvas, its tooltips, the palette's rows, notifications, the branch pill, the comparison title | Without marks (`commentLineText`, `commentText`): references as written, emoji as themselves |

The Branch Explorer's caption card lays its first line over the canvas's, so both draw `summaryOf`'s text.

## Copying

Copying from a shown comment gives back what was written where it shows something else (`copyAsSource`): a chip its
spec, a person their `@name`, an emoji its `:name:`, an image its Markdown. "Copy comment" copies the stored text.

## Images

An image (`![alt](https://…)`) shows as a chip with its description; on hover its picture shows, fetched from its
host only then, with no referrer (`CommentImage`); a click opens it in the browser. A merge request's description
will show its images in place (`images="inline"`). The page's Content-Security-Policy allows `https:` images for
this (ARCHITECTURE.md, "What leaves the device").

## Code

A fenced block keeps its language (`MarkdownBlock.language`, `data-language` on its `pre`); it shows in the code font,
not yet highlighted.
