# Merge requests

A merge request asks to merge a branch into another, its **destination**, once reviewed. On the server it is a code
review with two more fields: where it merges and where that stands. So it is one object with code reviews here too:
reviewers, their statuses, comments, change requests, rounds and notifications are the review's, as
docs/features/code-reviews.md says. This doc holds what is a merge request's alone.

Sandbox: `scripts/sandboxes/merge-requests.sh` builds a task branch per case below.

## What makes a review a merge request

- `cm find review` prints `{mergerequeststatusname}`, the state in English whatever the client's language (`None`,
  `Draft`, `Open`, `Closed`, `Merged`), and `{destination}`, the destination branch's spec (`br:/main`), empty for a
  plain review (`FOUND_REVIEWS`). `{mergerequeststatus}` translates the state and adds a prefix: never read.
- A review is a merge request when its state is one of the four **and** it has a destination (`mergeRequestOf`,
  `CodeReviewSummary.mergeRequest`, `MergeRequestInfo`); anything else, a state this version doesn't know included, is
  a plain code review. The destination is kept as a branch name, `br:` stripped.
- The two fields cost nothing measurable on a large repository's find (about 7,000 reviews), so every read that lists
  reviews carries them: the list, the branch chips, the palette, a review's page.
- A merge request's source is always a branch: the review's target, named as any review's (`BranchNamesCache`).

## States

| State | Means |
| --- | --- |
| **Draft** | not ready to review or merge |
| **Open** | ready: reviewers review it, and it can be merged |
| **Merged** | merged into its destination |
| **Closed** | given up, not merged |

Each has its glyph and its color wherever it shows (`MERGE_REQUEST_STATE_ICONS`, `--merge-request-<state>` in
`styles/tokens.css`, both themes): a pull request's glyph, dashed for a draft, a merge once merged, crossed once
closed. The glyph differs by state, so color never tells it alone, and a tooltip names it with its destination
(`mergeRequestTip`: "Open merge request into /main"). The **review status** (Under review, Reviewed, Rework required)
is another thing: where the review stands, for merge requests and code reviews alike, with its own icons
(code-reviews.md). A merge request **still to merge** is Open or Draft (`isActiveMergeRequest`).

## One view: Merge requests

The sidebar's **Merge requests** (view id `codeReviews`; links `merge-requests`, and `code-reviews`, its older name,
still opens it) lists merge requests and code reviews together: a review of a changeset or a shelve, or of a branch
with no destination, is the rarer sibling, not another feature. Two lists of the same object (a Merge requests view
beside Code reviews) were rejected: two badges, and "where is my review of that branch?".

- **The row** leads with the state glyph before the number, in a fixed-width slot a code review leaves empty, so the
  numbers stay in line (`codeReviewColumns`). The Status column stays the review's.
- **Changes** says `task → main` for a merge request: the source gives way when narrow, the arrow and the destination
  stay whole (the destination is usually short). Its tooltip: "Merge /main/task into /main".
- **The State chip** (the store's `state`, `MergeRequestStateFilter`): **Active**, where it rests, keeps the code
  reviews and the merge requests still to merge; **Merged** and **Closed** one state; **All** everything.
  Merged and Closed are the server's (`where mergerequeststatus = 'Merged'`, `codeReviewsQuery`); Active and All ask
  for no state and share one query key, Active narrowing locally (`matchesState`): `cm find` takes one state per
  query. An older version's remembered filters have no state and read as Active.
- **Waiting for me** (`waitingForMe`): a reviewer waits on a code review or an **Open** merge request, never a draft,
  a merged or a closed one; an author's rework waits on a code review or a merge request still to merge. The sidebar's
  count follows.
- **Opened by me** (`matchesOpenedByMe`): the user's code reviews not reviewed yet, and their merge requests still to
  merge whatever the review says: a reviewed one is still theirs to merge.
- The text filter also finds the destination and the state's name ("main", "draft": `reviewFilterTexts`).
- **The details panel** says "Merge request", the state's badge with the review status's icon beside it, and the
  source "into" the destination.

## Where a branch's merge request shows

- **Which review stands for a branch** (`reviewOfEachBranch`, every surface showing one review of a branch: the
  Branches view's and the Branch Explorer's chips, finishing a task): a merge request still to merge, over any newer
  review; else the newest. Two still to merge: the newest.
- **The chip beside a branch's name** (`reviewChipOf`, `CodeReviewChip`, the Branch Explorer's `drawReviewChip`)
  leads the review status with the state's glyph. Narrow, it shows the state alone until the request is Open and
  reviewed, then the thumbs-up alone: at a glance, whether it can merge. The canvas draws the state as a shape of its
  own per state (a ring, dashed for a draft, a disc once merged, crossed once closed). Their tooltips name it and its
  destination (`reviewLine`). No new column and no "+N more": the list filtered by the branch shows the others.
- **The palette's** `cr:` rows show the state's glyph and "→ /main" (`codeReviewResult`, `codeReviewResultDetail`).
- **Links** to a merge request are written `…/merge-requests/12` (docs/features/deep-links.md); both words open either.
