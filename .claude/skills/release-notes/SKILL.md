---
name: release-notes
description: Write the release note of a Unity Version Control — Desktop pull request, the "## Release note" section of its body that users read in What's New and on the releases page. Use for every pull request, before `gh pr create`, and whenever a pull request's change grows or its note is asked about.
---

# Release notes

A release note is what the people who use the app read to learn what a new version gives them: in What's New, inside
the app, and on the GitHub releases page. It is not for reviewers: the pull request's title and the rest of its body
are. The two are written apart, for different readers. Write the note for someone who uses version control every day,
has never seen this change, and will read it once, quickly.

**A release note is part of the product's UX**, held to the same bar as a screen: it's the first a user sees of a
change, and often the only way they learn it exists. A good one is read in a few seconds, and leaves the reader
wanting to try it and knowing where:

- **The benefit first**, then how: what the user can now do, or what stopped going wrong, before any detail.
- **A way to try it now**: the place, the click, the shortcut. One concrete step beats a paragraph of description.
- **One idea per note**, in the app's own calm voice: no hype, no exclamation marks, nothing that oversells.
- **Words and picture work as one**: the picture shows what the sentence says, so neither repeats the other, and
  each note in What's New reads at a glance next to the others.

Every pull request has one: a note, or "None:" and why. The Release note check (`readReleaseNote`,
`scripts/build/releaseNote.ts`) fails a pull request without either.

## The format

In the pull request's body, the section `## Release note` holds exactly one note:

```markdown
## Release note

### New: Run your own tools on files, changesets and branches

Add the tools you use every day, like an editor, a script or a build, in **Settings › Tools**. They show up in the
menu of files, changesets, branches, labels and shelves, and open on what you right-clicked.

![The Tools page in Settings](./tools.png)
```

- `### <Kind>: <Title>` on the first line. The kind is one of:
  - **New**: something users couldn't do before.
  - **Improved**: something they could already do, now easier, faster, clearer or more complete.
  - **Fixed**: something that went wrong and now doesn't.
  Choose by what the user gets, not by the branch name: a `feature/` branch that makes an existing view better is
  **Improved**; a `perf/` branch users will feel is **Improved**.
- The description under it: Markdown. Headings inside it are `####`, never `###` (that starts a note).
- A picture or a GIF goes in only when it adds to what the note says, framed on what it shows: see "Pictures".

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
- **A picture, a table or a snippet only when words aren't enough**: a picture by "Pictures" below; a table or a
  snippet for a format the user types (`cs:4821` in a comment).

## Pictures

A picture is there for one reader: a user reading the note once, quickly, in What's New. It earns its place when that
reader gets the change faster from it than from the sentence; otherwise it's noise between the notes. So the question
is never "is this a feature or a fix?" but "what would the user see?". A fix of something drawn wrong is the
clearest case for a picture there is, and a new feature that lives in a menu everybody knows may need none.

Decide three things, in this order, for every note.

### 1. Picture or not: what the user sees

| What the change gives users | The picture |
| --- | --- |
| Something drawn wrong, now right: overlapping, cut off, misaligned, in the wrong place, the wrong color in a theme | **Before and after**, the same crop |
| A new look for a part of a view that was already there: a denser list, a clearer card, a rearranged panel | **Before and after**, the same crop |
| Something new to look at: a view, a page, a dialog, a panel, a kind of row | **After**: the new thing, whole |
| A new arrangement of a whole screen, or a feature spread over the window (a sidebar entry and its view) | **After**: the window, the sentence saying what it replaces (two windows joined show too small to read) |
| A movement: something that follows the pointer, a drag, an animation, a flow whose news is the sequence itself, not one screen in it | **A GIF** |
| A movement that went wrong: a flicker, a jump, a list that lost its place, something that should have stayed put | **A GIF** of it now, the sentence saying what it did before |
| An entry added to a menu, a button to a toolbar, a shortcut | **None**: the sentence names where it is (**Copy ▸ Link** in the branch's menu). A picture only when it's hard to find or its icon is the news |
| Nothing looks different: faster, a crash or an error gone, the right data where the wrong one showed in the same place, a word changed, a default | **None**: the sentence says it; a picture of an ordinary screen tells nothing |

When two rows seem to fit, take the one closer to what the user noticed before (a bug) or will notice first (a
feature). When none fits, apply the test below to the picture you would take; if it fails, there is none. Write down
the row you chose: the reviewer gets it with the note (CLAUDE.md "Delivering work", step 4), and a note with no picture
says there which row made it none.

**The test, on the picture itself.** Open the file you made (the Read tool shows it) and look at it as the note
shows it, about 600 pixels wide. With only the title beside it, could someone point at the change within two
seconds? If it looks like any screenshot of the app, nothing in it points at the change: crop tighter, set up the
state that shows it, add the before, or drop the picture. Never attach a picture you haven't looked at.

One picture per note at most; a before and after made into one picture counts as one.

### 2. Plan the shots when the work starts, and only those worth their cost

A picture costs time and tokens: an app to build and start, a sandbox, steps to find, a file to look at. A before and
after costs the most, so spend on it only where the difference itself is the news:

- **A before and after** when users would not understand the change without seeing both: a drawing error, a restyled
  part of a view. Never when the sentence already says what was wrong ("the list lost its place") and the after shows
  the rest: then the after alone.
- **The before only when it's cheap**: one `scripts/screenshot.mjs` run while you reproduce the problem anyway. If it
  wasn't taken, build `main` again only for a fix whose whole point is how it looks; otherwise the after alone, the
  sentence saying what it replaced.
- **One picture, once**: settle the steps and the crop on the first try, look at the result once, and stop. A second
  attempt is for a picture that failed the test, not one that could be a little nicer.
- **When in doubt between a picture and none**, the table decides, not the effort: a change on a "None" row never gets
  one because it was easy to take.

A "before" can only be taken before the change. When the table says the note will want one, take it as soon as you
reproduce the problem or open the screen to change: on `main`, in a sandbox, the whole window at the size you'll use
for the "after", with the theme and state written down, so the "after" can match it exactly. Keep it outside the
repository (the session's scratch or temp folder) with its path written down: it goes to the reviewer and into the
pull request, never into a commit. Taken later, it costs a build of `main` in a worktree.

### 3. Frame it: element, region or window

What's New shows a picture as wide as the text (about 600 pixels) and at most 360 pixels tall, and a click shows it
larger. Frame the smallest thing that holds the change and tells where it is:

- **An element** when the change fits in one: a dialog, a popup, a menu (open, with the row it opened from), a card,
  a toolbar. `playwright-cli screenshot <ref>` takes it already cropped.
- **A region** when it's part of a view: take the window (`playwright-cli screenshot`) and crop the file, keeping a
  strip of what places it (the panel's header, the line numbers, the file list's edge), so the user knows where to
  look. If the change is a few pixels in a big crop (a button in a whole diff), crop tighter, and take the shot at
  twice the pixels (below): cropping removes clutter but enlarges nothing.
- **The window** only when the news is the whole screen: a new layout, a feature spread over it. A sensible size
  (about 1200×760), so its text still reads when shrunk to 600 pixels.

And for all three:

- **The state that shows it**: the menu open, the row hovered, the conflict selected, the comment written. Something
  shown only on hover is shot while hovered (Playwright's screenshots leave the pointer out).
- **Wider than tall**, or about square: a tall crop is shrunk to 360 pixels high and its text gets hard to read.
- **Real-looking content**: a sandbox (`scripts/sandboxes/`) with sensible names, nothing personal or internal on
  screen; the light theme, unless what changed is in the dark one.
- **Small things at twice the pixels.** What's New never shows a picture larger than its own pixels, so a 300-pixel
  crop of a button stays 300 pixels wide in a 600-pixel note. Take every shot whose crop is under about 600 pixels
  wide at twice the pixels, with `scripts/screenshot.mjs --scale=2` (CLAUDE.md "Seeing the app"): it captures the
  real window at twice its points on any screen, and its `move:<x>,<y>` step rests the pointer for what shows only on
  hover. Not `playwright-cli screenshot --hires`: over the app's debugging port it takes the screen's own density,
  one pixel per point on most screens.

### Before and after

Two shots of the same place, the same window size, theme, content and state, so the change is the only difference,
joined into one labeled picture. Take both of the whole window with the same steps, the before from `main` and the
after from the branch, then let the script crop them with one box, in the shots' pixels:

```bash
steps=(open:uvcs-code-reviews 'click:Code reviews' 'dblclick:Switching with changes keeps them' tab:Changes
       size:1300x850 move:702,342)                                          # the same steps for both
node scripts/screenshot.mjs --scale=2 "$TMPDIR/before.png" "${steps[@]}"   # built from main
node scripts/screenshot.mjs --scale=2 "$TMPDIR/after.png" "${steps[@]}"    # built from the branch
npx electron scripts/beforeAfter.mjs --scale=2 --crop=1124,580,876,204 "$TMPDIR/before.png" "$TMPDIR/after.png" before-after.png
#   --dark for shots of the dark theme
```

It lays the two side by side, or one above the other when they're wide strips, whichever shows larger in the note
(`beforeAfterLayout`), and refuses a box past the shots or two shots of different sizes. Joined, each shot shows at
about half the note's size (under 300 pixels wide side by side, under 160 tall stacked), so a before and after is
for an element or a region, never two windows: take its shots at twice the pixels. The alt text says what
changed: `![Before, the outline crossed the + button; after, the button is drawn above it](./before-after.png)`.

### GIFs

GIFs are welcome wherever the news moves: a still of a drag or a hover shows where it ends, not that it follows the
hand. Keep them for that; a still reads faster everywhere else.

- **The same framing as a picture**, to the zone where it happens, with its context around it.
- **Short and looping**: three to eight seconds, one action, starting and ending where the user would; no waiting
  at the start, the pointer moving as a person moves it.
- **Light**: about 12 frames a second, no wider than about 900 pixels, a few megabytes at most (GitHub takes up to
  10 MB, and What's New downloads it).
- **A GIF, never a video file**: What's New shows a GIF as a picture; a video in the note doesn't show there at all.
- **How**: record with `playwright-cli video-start clip.webm` … `video-stop` (CLAUDE.md "Seeing the app"), then make
  the GIF with ffmpeg, cropping as you go (`crop=width:height:x:y`, in the recording's pixels):

  ```bash
  ffmpeg -i clip.webm -vf "crop=900:560:180:120,fps=12,scale='min(900,iw)':-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" -loop 0 clip.gif
  ```

### Putting it in the note

- **Name it**: the alt text says what the picture shows (`![The Tools page in Settings](./tools.png)`); it is what a
  screen reader says and what shows if the picture can't load.
- **Reference it after the description and attach it**: `gh pr create --attach ./tools.png` (or `gh pr edit
  --attach`) uploads the file and puts its link there. An unreferenced one is appended after the closing line,
  outside `## Release note`, where What's New never shows it; the Release note check (`misplacedPicture`) fails a
  body like that.
- **It serves reviewers too** (CLAUDE.md "Delivering work", step 6). A note with no picture for users may still need
  one for reviewers (a change visible in the app but not worth a picture in the note): that shot goes under "Behavior
  with this pull request", never in the note.

### Examples

| Note | Picture | Why |
| --- | --- | --- |
| **Fixed:** The button to comment on a line shows above the outline of commented lines | Before and after, cropped to the line and its number | What users saw was a drawing error; the pair shows it at once |
| **New:** Run your own tools on files, changesets and branches | The Tools page in Settings, as an element | A new page; its look is the news |
| **Improved:** Pending changes load quickly in very large workspaces | None | Nothing looks different; the numbers belong in the sentence |
| **Fixed:** Closing a window no longer stops what it's doing | None | There's nothing to see |
| **New:** Copy a link to any branch | None | **Copy ▸ Link** in the branch's menu says where it is |
| **Improved:** Drag a branch onto another to merge it | A GIF of the drag, cropped to the two branches | It's a movement |

## The words

The note uses the app's words, the ones on screen and the ones users of UVCS already use: workspace, branch,
changeset, label, shelve, checkin, merge, xlink, code review, pending changes. Never:

- the code's names: components, files, functions, `cm` commands or flags, settings keys, error class names;
- development words: refactor, PR, pull request, API, IPC, renderer, query, cache, parser, regression;
- internal names, reviews, approvals, tickets or people, nor why the change was made inside the team (the repository
  is public: CLAUDE.md "Public text says what changed");
- hedges and filler: "various improvements", "under the hood", "some issues", "now properly".

## Rewritten notes

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
5. Would a user reading it once want to try it, and know where to go?
6. Does the picture, or its absence, follow "Pictures": the row of the table the change fits, and the test passed on
   the file itself?
