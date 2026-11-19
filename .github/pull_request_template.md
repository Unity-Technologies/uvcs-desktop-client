## What does this pull request do?

<!--
The title says exactly what this pull request does, as an order with its effect ("Make the account switcher stand out
on Home"): the writing-for-people skill's "Pull request titles". Everything here is written with that skill, then the
humanizer skill (.claude/skills/).
-->

One or two plain sentences: what changes, and how it helps.

## Release note

<!--
What the app's users read in What's New and on the releases page: written for them, not for reviewers, with the
release-notes skill (.claude/skills/release-notes). One note:

### New: <what users can now do>      (or Improved: / Fixed:)

<A sentence or two: what it is, where to find it; for a fix, what users saw and what happens now.>

Only when the skill's "Pictures" says the note gets a picture (it decides whether, and which: the element, a region,
the window, a before and after or a GIF), it goes here, attached with `gh pr create --attach ./shot.png`:

![What it shows](./shot.png)

Or, when users have nothing to read: "None: <why>". The Release note check fails the pull request otherwise.
-->

## Current behavior

What the user sees or the app does today (for performance work, the numbers and how they were measured).

## Behavior with this pull request

What the user can now do or see, and the numbers after. A visible change shows its screenshot here when the release
note has no picture, or when the note's crop can't show reviewers what changed; it is referenced in the body and
attached with `--attach`.

## How it was implemented

For a product owner and the next developer, skipped only when the diff makes it obvious: the approach and why it was
chosen, the pieces it adds or changes, named so they can be grepped (`RevisionCat`, `useQueriesByFrame`), the `cm`
commands it adds, removes or batches, and the alternatives tried and dropped.

## Behavior changes

Anything a user or another layer will notice beyond the goal: a setting, shortcut, copy or default that changed, data or
settings stored differently, a `cm` version it needs, something that now works differently on one OS. "None" if so.

## Checklist

- [ ] `npm run typecheck` and `npm test` pass. What the new tests cover:
- [ ] Seen working in the app, in both themes, a narrow window and a development build, with a clean console:
- [ ] `npm run e2e` passes, if it touches startup, navigation or many views
- [ ] Other areas the change reaches, and how they were checked:
- [ ] Reviewed in a clean context (`.claude/agents/reviewer.md`): what it found, what changed for it, and why any
      finding was declined:
- [ ] `docs/` says what's now true (what changed, or why nothing did):

## Fixed issues

Links to the issues this closes, or "None".
