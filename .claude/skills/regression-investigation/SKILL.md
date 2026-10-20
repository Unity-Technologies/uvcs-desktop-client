---
name: regression-investigation
description: Investigate and fix a reported bug in Unity Version Control — Desktop, find why the tests let it through, and leave the harness able to catch that kind of bug from then on. Use when a defect is reported, when it may be a regression, or when the origin of unexpected behavior is unclear.
---

# Regression investigation

The fix is only the start. The real target is the harness: every bug that got through shows a hole in the test suite,
which is this repository's only memory (CLAUDE.md "Tests are the quality gate"), and the investigation ends when that
hole is closed, so this bug and the bugs like it fail a test before they reach a user again. To get there: why the
defect happened, when it got in, and why the tests let it through. Evidence over guesses; tests that pin the behavior
over broad patches or new rules.

Follow CLAUDE.md "Delivering work" as for any change: branch first (`fix/<topic>`), small commits, the failing test
committed before the fix, a clean-context review, a pull request.

## 1. Reproduce the symptom

- Write down the exact observable failure: the workspace, the view, the clicks, what shows, what should show.
- Reproduce it in the real app with the `playwright-cli` skill (CLAUDE.md "Seeing the app"). The reported workspace
  is the user's: read it, never write to it. When a sandbox script (`scripts/sandboxes/*.sh`) built it, it is the
  reproduction recipe; rebuild it only against the local server, and only when the user agrees.
- Watch the command log (⌘⇧L) and the console: which `cm` commands ran, what they answered, any renderer error.
  Running the read-only `cm` command yourself (`cm diff`, `cm cat`, `cm find`, `cm status`) shows what the app was
  given, which splits a parsing bug from a rendering bug.
- If the expected behavior is unclear, find it before deciding the code is wrong: the feature doc
  (`docs/features/*.md`), its tests, its pull request, the official clients (CLAUDE.local.md, read only).
- If it can't be reproduced, say what's missing. Never claim a reproduction you didn't see.

## 2. Find the root cause

Follow the data through the layers until the whole symptom is explained (ARCHITECTURE.md "How a request flows"):
`cm` output → the parser in `main/cm/` → the service → `UvcsApi` / IPC → the query or mutation → the hook → the
component → Pierre. At each step check what goes in against what comes out; the first step whose output is wrong is
where the bug lives. Don't stop at the first suspicious line if it doesn't explain everything.

A failing unit test that reproduces the symptom with input shaped exactly as `cm` prints it is the best evidence and
the start of the fix. Keep verified facts and hypotheses apart.

## 3. Classify it

- **Regression**: it worked, and a later change broke it.
- **Original defect**: it was wrong since the feature landed.
- **Design gap**: the case was never specified (the feature doc doesn't say, no test covers it).
- **Environment**: it depends on the machine, OS, `cm` version or server, not on the code.
- **Unresolved**: the evidence doesn't decide. Say so; don't force it.

Prove it with history, not with the date of the report:

- `git log --oneline -- <file>`, `git log -L <start>,<end>:<file>`, `git log -S '<symbol>'`, `git blame`: when the
  faulty lines came in, and what they replaced.
- Check out the feature's first commit (or its pull request's head) in a throwaway worktree
  (`git worktree add /tmp/<name> <sha>`) and run the new failing test there, or the app. Fails there too → original
  defect; passes there → bisect (`git bisect run npx vitest run <test file>`) to the commit that broke it.
- `gh pr view <n>` gives the change's intent and how it was checked. Remove the worktree when done.

## 4. Ask why the harness missed it

Be precise about which of these it is; each leads to a different lesson:

- **No test was ever written** for the behavior.
- **A test exists but not for this case** (a missing edge: empty, CRLF, Unicode, a moved file, a range at the end of
  a file, an xlink, a Windows path).
- **A test covers the case but can't fail on it**: its input isn't shaped as `cm` really prints it, a fake answers
  something `cm` never would, it asserts on a layer below where the bug shows, or it checks something too loose.
- **Not reasonably detectable by the automated checks**: it shows only on screen, in a component (`.tsx` isn't
  unit-tested), or on a real server. Then ask whether the logic could have lived in a pure, tested `.ts` module, and
  whether `npm run e2e` or the Playwright check of the change should have exercised it.

For a regression, also: did the breaking change's pull request add or change tests, and why didn't the old ones fail?

## 5. Fix it, smallest justified change

- Fix the cause, not the symptom, in the layer where it lives.
- Test at the level where it broke (CLAUDE.md "Tests are the quality gate"): synthetic `cm` output (`main/cm/testing/cmOutput`),
  `fakeCmClient` for services, `fakeApi` for the renderer. Fast, deterministic, the same on every OS.
- Follow the idiom of the code and tests next to it. No unrelated refactors, no speculative defensive code, no new
  abstraction or harness layer "in case".
- Update the feature doc if it was wrong or silent about the rule the fix enforces.

## 6. Verify

- The new test fails without the fix and passes with it: run it against the old code (commit the test first, or
  `git stash` the fix) and say which you did.
- `npm run typecheck`, `npm test`; `npm run e2e` when it touches startup, navigation or many views.
- See it fixed in the app, on the reported flow, both themes, a development build too when it's a component.
- Read the final diff for anything unrelated or test-only.
- Report any check you couldn't run, and why. Never claim a pass you didn't see.

## 7. Harden the harness

This is what the investigation is for. From the gap found in step 4, close it for the *kind* of bug, not just this
one input:

- Pin the behavior the user relies on, at the layer where it broke, not only the line that was wrong: if the
  dialog showed nothing, a test that its content is the moved code, whatever the next refactor does underneath.
- Look for siblings: other callers of the code that broke, other cases sharing the faulty assumption (other
  formats, other layouts, the other side of a diff). A test for each one that can break the same way.
- Correct what misled the tests: a fixture that doesn't look like real `cm` output, a fake that answers what `cm`
  never would, a helper tested apart from the way it's really called.
- Move logic that only a screen could check out of a component into a pure, tested `.ts` module, or add the step to
  `npm run e2e` when only the real app shows it.
- Each of these goes in the same pull request, in its own commit.

Stay pragmatic: things go wrong sometimes, and the improvement must be proportionate to what this incident proves.
- Don't add hard requirements, new mandatory rules or generic validation layers to CLAUDE.md or the docs for one
  bug. A recurring weakness, seen more than once, earns a rule; one incident earns a recommendation.

## Report

In the pull request (its template's sections) and to the user, concise and auditable:

1. **Symptom**: what failed and how it was reproduced.
2. **Classification**: regression, original defect, design gap, environment, or unresolved, with the evidence.
3. **Root cause**: the mechanism, file and symbol.
4. **History**: the commit or pull request that brought it in, if established.
5. **Coverage gap**: which kind from step 4, and why.
6. **Fix and tests**: what changed and which checks ran.
7. **Harness hardened**: the tests that now catch this kind of bug, what is only recommended, and why nothing broader is needed if so.

Name what's still open rather than presenting a guess as a fact.
