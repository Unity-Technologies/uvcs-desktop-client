---
name: writing-for-people
description: Write any text a person reads in plain, clear English that says exactly what it means. Use for every pull request title and body, release note, commit message, error message, toast, label, tooltip, dialog and doc, before it is committed, posted or shown.
---

# Writing for people

Every text a person reads is written for that person: a reviewer scanning a list of pull requests, a user reading
What's New, a user who just saw an error, the next developer reading a doc. They read it once, quickly, and they
weren't there when the work was done. If they have to read it twice to know what it means, it failed.

This skill sets what to say. The `humanizer` skill (`.claude/skills/humanizer`) then takes out the habits that make
text sound machine-written. Use both, in that order, on everything listed in "What it covers".

## The rule

**Say exactly what it does, for the person reading, in the fewest plain words.**

- **The effect before the mechanism.** First what changes for the reader (the account switcher is easier to spot),
  then how, if they need it (it has its own card). Never only the how.
- **One idea.** A title or a first sentence holds one thing. If it needs "and", a colon or "instead of", pick the
  main thing, or the work is two pull requests.
- **Common words.** Words a person would say out loud to a colleague: "stand out", "easier to find", "faster",
  "no longer". The app's names for things (workspace, branch, changeset, shelve, Pending changes) are fine; the
  code's names never reach a user.
- **No comparisons the reader didn't ask for.** "Like the workspace and branch pills", "as a branch diff does", "the
  way the details panels do" make the reader picture a second thing to understand the first. Say what the thing now
  is. Keep a comparison only when matching the other place is the whole point, and even then put it second.
- **Concrete over abstract.** "Takes 2 seconds instead of 40" over "loads quickly"; "has its own card" over "reads as a
  control".

## How to work

1. **Answer one question first**: what does this do for the person reading it? Write that answer as one short
   sentence before anything else. It becomes the title or the first sentence; everything after it supports it.
2. **Draft** the text with the rules for its kind, below.
3. **Run the `humanizer` skill on the draft** in embedded mode (it returns only the final text). It catches the
   staged contrasts, dashes, triads, inflated words and closers that slip into every draft. Keep every fact, name,
   number and shortcut it was given; humanizer rewords, it never drops a claim.
4. **Read it as its reader**, once, with nothing else on screen: someone who never saw the work. Do they know what it
   does, and what to do next? If not, go back to step 1.

## What it covers

| Text | Who reads it | Where its own rules are |
| --- | --- | --- |
| Pull request title | A reviewer, in a list of pull requests and in the merge commit | "Pull request titles", below |
| Pull request body | A reviewer and a product owner, once | "Pull request bodies", below; the sections come from `.github/pull_request_template.md` |
| Release note | A user, in What's New and on the releases page | The `release-notes` skill, then this one |
| Commit message | The next developer, reading the history | CLAUDE.md "Commits", then this one |
| Error message, toast, confirm dialog | A user, at the moment something went wrong | "Error messages", below |
| Label, tooltip, empty state, button | A user, at a glance | CLAUDE.md "Conventions", Copy |
| Docs (`docs/`, skills, comments) | The next developer or agent, arriving cold | CLAUDE.md "Docs" |

Code, commands, symbols in backticks and quoted `cm` output stay exactly as they are.

## Pull request titles

The title says what the pull request does, as an order: "Make …", "Show …", "Fix …", "Remove …". It is read in a list,
next to dozens of others, so the verb and the thing come first.

- **Imperative, sentence case, no period.** Under 60 characters when it can be; never past 72.
- **What it does, with its effect.** "Make the account switcher stand out on Home", not a description of how it looks
  now ("The account switcher on Home sits on a card").
- **A fix names the problem users saw.** "Fix the app's icon in Activity Monitor", "Stop the app running out of memory
  when asked to sign in again".
- **Work users don't see says what it changes in the code**, just as plainly: "Rename MergeRequest to RequestedMerge
  in the merge operation".

| Before | After |
| --- | --- |
| The account switcher on Home sits on a card, like the workspace and branch pills | Make the account switcher stand out on Home |
| A roomier top bar: its workspace, branch and search have room around them | Add space around the workspace and branch in the top bar |
| When a server's session ends, every window on it shows one sign-in screen, found as you come back | Show one sign-in screen when your session on a server ends |
| Incoming lists its changesets as a branch diff does | Fold Incoming's changesets under All incoming changes |
| Branch attributes on a code review read like the details panels, with Add at the title's right | Move Add to the title of a code review's Branch attributes |
| Choose what to download shows what Apply changes as calm pills | Show what Apply will download or remove as a tag on each row |
| The Files view's header no longer shows New file and New folder buttons | Remove New file and New folder from the Files view's header |
| Quick commands never send a cm shell an option it would keep for its whole session | Keep session-wide options out of pooled cm shells |
| A release fails within 30 minutes when its signing gets stuck, instead of waiting up to 150 | Stop a release after 30 minutes when its signing gets stuck |
| Partial workspaces on a changeset open, and a refused switch says what it can't switch to | Two pull requests: "Open partial workspaces on a changeset" and "Say why a switch was refused" |

## Pull request bodies

The body is read top to bottom once; each section answers its heading and nothing else.

- **"What does this pull request do?"**: one or two sentences. The first says what changes and why it helps; the
  second, if needed, says where.
- **"Current behavior" and "Behavior with this pull request"**: what the user sees, in short concrete sentences or a
  short list. Numbers when there are numbers. CSS values, symbol names and the history of the code go in "How it was
  implemented", not here.
- **"How it was implemented"**: for a developer, so symbols and `cm` commands belong here, but still in plain
  sentences: the approach first, then the pieces.
- **The review and the checklist**: what was found and what changed, without praise or filler.

| Before | After |
| --- | --- |
| On Home, the account switcher at the top of the sidebar sits on a card, like the workspace and branch pills at the top of a workspace's window, instead of blending into the sidebar. | The account switcher on Home now has its own card, so it's easy to spot and doesn't blend into the sidebar. |
| Gives the window's top bar more room: the workspace and branch pills, the search and a repository's Create workspace sit 8px clear of the bar's edges instead of nearly touching them. | Adds space between the top bar's edges and what's in it (the workspace, the branch and the search), which nearly touched them. |
| Choose what to download shows what Apply will change as a small Download or Remove pill at the row's end, and its checkboxes and names keep their usual look. | In Choose what to download, each row you change gets a small Download or Remove tag at its end. Checkboxes and names no longer change color. |

## Error messages

An error message is read by a user who was in the middle of something and now can't finish it. It says what happened
in their words, and what they can do next.

- **What happened, then what to do.** "The server can't be reached. Check your connection and try again."
- **The user's words, never the code's.** No `cm` output, flags, exception names or "failed to …". The detail for a
  bug report goes in the log, which Help ▸ Show Log Files opens.
- **No blame, no apology, no "please".** State it calmly and move on.
- **Specific.** Name the file, branch or server it's about when there is one.

| Before | After |
| --- | --- |
| cm is waiting for input ("Password:"). | The server asked for your password. Sign in again to continue. |
| Some changes are still pending after undoing them | Some changes couldn't be undone. They're still in Pending changes. |
| The shelve finished but no shelve was reported, so the workspace was left as it was. | Your changes were shelved, but the app couldn't find the shelve, so it didn't touch your workspace. |
| Failed to get thumbnail from local thumbnail cache reference | This image's preview couldn't be loaded. |

## Words to watch in this repository

Agents writing about this app drift into a private vocabulary. Each of these hides what really changed:

- **"sits on", "sits above", "lives in"**: say "is on", "is above", "is in", or what the user can now do.
- **"reads as", "reads like", "reads calmer"**: say what it looks like or what it now makes easy.
- **"calm", "quiet", "roomy"** about the UI: say what changed (less color, more space) and what it helps with.
- **"the way X does", "as X does", "like X"**: see "No comparisons the reader didn't ask for".
- **"found as you come back", "offered again", passive phrases in general**: say who does what.

## Check it before it ships

1. Could someone who never saw the work say, after one read, what it does?
2. Does the title or first sentence say the effect, not only the mechanism?
3. Is there one idea, with no "and", colon or "instead of" holding a second one?
4. Is every word one the reader already uses?
5. Did the `humanizer` skill run on it, and did every fact survive?
