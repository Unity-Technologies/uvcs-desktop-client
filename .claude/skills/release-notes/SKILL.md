---
name: release-notes
description: Write the release note of a Unity Version Control — Desktop pull request, the "## Release note" section of its body that users read in What's New and on the releases page. Use for every pull request, before `gh pr create`, and whenever a pull request's change grows or its note is asked about.
---

# Release notes

A release note is what the people who use the app read to learn what a new version gives them: in What's New, inside
the app, and on the GitHub releases page. It is not for reviewers: the pull request's title and the rest of its body
are. The two are written apart, for different readers. Write the note for someone who uses version control every day,
has never seen this change, and will read it once, quickly.

Every pull request has one: a note, or "None:" and why. The Release note check (`readReleaseNote`,
`scripts/build/releaseNote.ts`) fails a pull request without either.

## The format

In the pull request's body, the section `## Release note` holds exactly one note:

```markdown
## Release note

### New: Run your own tools on files, changesets and branches

Add the tools you use every day, like an editor, a script or a build, in **Settings › Tools**. They show up in the
menu of files, changesets, branches, labels and shelves, and open on what you right-clicked.

![Settings › Tools](./tools.png)
```

- `### <Kind>: <Title>` on the first line. The kind is one of:
  - **New**: something users couldn't do before.
  - **Improved**: something they could already do, now easier, faster, clearer or more complete.
  - **Fixed**: something that went wrong and now doesn't.
  Choose by what the user gets, not by the branch name: a `feature/` branch that makes an existing view better is
  **Improved**; a `perf/` branch users will feel is **Improved**.
- The description under it: Markdown. Headings inside it are `####`, never `###` (that starts a note).
- A picture goes in only when it adds to what the note says, cropped to what it shows: see "Pictures".

A pull request with nothing for users writes `None:` and the reason, in one line:

```markdown
## Release note

None: moves code between services; nothing changes for users.
```

That is for refactors, tests, docs, tooling, CI, and dependency updates nobody will notice. If users can notice
anything at all (faster, a different word on screen, a crash gone), it gets a note.

## The title

- **What the user gets**, in one short line: under 80 characters, never past 150.
- **New** and **Improved** say what the user can now do or see: "Run your own tools on files, changesets and branches",
  "Hide the details panel the same way in every view".
- **Fixed** says what no longer goes wrong, from what the user saw: "Closing a window no longer stops what it's
  doing", never "Fix window close bug".
- Starts with the thing that matters to the user. Sentence case, no period at the end.

## The description

- **Always there, fixes included.** The first sentence or two carry the whole message; what follows is detail for
  those who want it.
- **What it is, where to find it, when it helps.** Name the place in the app the way the app names it (**Settings ›
  Tools**, the **Branches** view, the changeset's menu) and the shortcut, if there is one (⌘I or Ctrl+I).
- **A fix says what users saw and what happens now**: "If you closed a window during an update, the update stopped
  halfway. Now the app waits for it to finish and closes the window then."
- **Short sentences, plain words.** Active voice, the user as "you". Usually one paragraph; more only when the
  feature needs it.
- **A picture, a table or a snippet only when words aren't enough**: a new view or dialog, a before and after, a
  format the user types (`cs:4821` in a comment). Never a picture of something a sentence says as well.

## Pictures

A picture earns its place only when it shows what the note delivers better than words: a new dialog, menu or panel,
a before and after, a layout the user has to see. Most fixes and many improvements need none. When in doubt, leave it
out: a note without a picture reads well; a picture that doesn't help makes the note harder to read.

What's New shows a picture inside the note, as wide as the text (about 600 pixels) and at most 360 pixels tall, and
a click shows it larger. So a picture must read at that size:

- **Crop it to what the note is about.** A feature in a popup: the popup. A part of a panel: that part. A menu: the
  menu open, with the row it opened from. Never the whole window, unless the note is about the whole window.
- **Keep just enough around it to place it**: a strip of the panel or toolbar it belongs to, so the user knows where
  to look in the app. Not so much that the feature becomes small.
- **Wider than tall**, or about square: a tall crop is shrunk to 360 pixels high and its text gets hard to read.
- **Real-looking content**: a sandbox (`scripts/sandboxes/`) with sensible names, the light theme, the pointer out
  of the way, nothing personal or internal on screen.
- **Take it with `playwright-cli`** (CLAUDE.md "Seeing the app"): `playwright-cli screenshot <ref>` takes one element,
  the popup or the panel, already cropped. For a zone that no element bounds, take the window and crop the file.
- **Name it**: the alt text says what the picture shows (`![The Tools page in Settings](./tools.png)`); it is what a
  screen reader says and what shows if the picture can't load.
- **Reuse the pull request's screenshot** when it already is that crop: reference the same file in the note and
  `gh pr create --attach ./tools.png` uploads it once for both. The pull request's own picture may show more for
  reviewers; the note's is cropped for users.

## The words

The note uses the app's words, the ones on screen and the ones users of UVCS already use: workspace, branch,
changeset, label, shelve, checkin, merge, xlink, code review, pending changes. Never:

- the code's names: components, files, functions, `cm` commands or flags, settings keys, error class names;
- development words: refactor, PR, pull request, API, IPC, renderer, query, cache, parser, regression;
- internal names, reviews, approvals, tickets or people, nor why the change was made inside the team (the repository
  is public: CLAUDE.md "Public text says what changed");
- hedges and filler: "various improvements", "under the hood", "some issues", "now properly".

## Before and after

| Not this | This |
| --- | --- |
| Avatars show two initials for a one-word user name, as the other UVCS clients do | **Fixed:** One-word user names show two initials |
| Every view's details panel hides and shows again the same way: a header button, ⌘I or Ctrl+I, the View menu | **Improved:** Hide the details panel the same way in every view |
| Fix ProcessPool leak when cm shell stdout closes | **Fixed:** The app stays fast after a long day of work |
| Stream cm status records instead of reading XML | **Improved:** Pending changes load quickly in very large workspaces |
| Add ToolsService and tool runner with placeholders | **New:** Run your own tools on files, changesets and branches |

## Check it before opening the pull request

1. Would someone who uses the app, but never saw this change, understand from the title alone what they get?
2. Does the description say where to find it, or what they saw before a fix?
3. Is every word one the app shows or a UVCS user already says?
4. Is it as short as it can be and still say all of that?
