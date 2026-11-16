# Merge requests

A merge request asks to merge a branch into another, its **destination**, once reviewed. On the server it is a code
review with two more fields: where it merges and where that stands. So it is one object with code reviews here too:
reviewers, their statuses, comments, change requests, rounds and notifications are the review's, as
docs/features/code-reviews.md says. This doc holds what is a merge request's alone.

Sandbox: `scripts/sandboxes/merge-requests.sh` builds a task branch per case below, a merged one whose branch is hidden
included.

## What makes a review a merge request

- `cm find review` prints `{mergerequeststatusname}`, the state in English whatever the client's language (`None`,
  `Draft`, `Open`, `Closed`, `Merged`), and `{destination}`, the destination branch's spec (`br:/main`), empty for a
  plain review (`FOUND_REVIEWS`). `{mergerequeststatus}` translates the state and adds a prefix: never read. Both
  fields are in `cm` 11.0.16.10616, the version reviews already need (code-reviews.md), so no read asks for a newer one.
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

## States and who may change them

- The moves a user can make (`mergeRequestMoves`): a **Draft** gets **Ready for review** (Open) or is closed; an
  **Open** one goes back with **Convert to draft** or is closed; a **Closed** one is reopened (**Reopen merge
  request**). A **Merged** one moves no more: `cm` takes it back to Open, but its branch is merged already. Merged is
  never a move: merging records it.
- **Close asks nothing**: Reopen undoes it, so it isn't a danger entry either.
- Each move is one quick `cm mergerequest edit <id> --mergerequeststatus=<state>` (`mergeRequestStateArgs`,
  `setMergeRequestState`, `query()`), the state by its English name. Setting the state it already has changes nothing
  and adds no note. The server needs the change permission on the source branch; its refusal shows as any `cm` error,
  titled by the move ("Couldn't close the merge request", `moveFailureTitle`).
- `cm mergerequest` is only for what a code review hasn't: the state and the destination. Everything else on a merge
  request (reviewers, statuses, comments, title, description, delete) stays `cm codereview`, which takes its id
  unchanged.
- The page and the lists show the new state at once (`showMergeRequestAs`, through `showReviewReadInListsIn`), so a
  badge doesn't flip back while the reviews are read again (`isAffectedByCodeReviews`).
- The moves are offered alike in the merge card, the page's ⋯ menu (`reviewPageMenu`) and a single row's menu
  (`codeReviewMenu`), in the menus' `act` group (`readyForReview`, `convertToDraft`, `closeMergeRequest`,
  `reopenMergeRequest` in `MENU_WORDS`). Several rows selected offer none.

## The page

A merge request's page is a code review's (`CodeReviewPage`, code-reviews.md "The review's page"), with where it merges:

- **The headline** (`reviewHeadline`): the state's badge, then the review status's, then "Ana wants to merge
  /main/task into /main"; "asked to merge … into" once merged (whoever merged it, the Merged badge says it is),
  "wanted to merge … into" once closed. Both badges stay: they say
  different things (where the request stands, where its review stands), and side by side they read as two, not noise.
- **The destination** changes in place while Draft or Open and its source branch is named (`DestinationPicker`;
  `reviewHeadline` decides): it reads as the headline's other
  branch with a small chevron, a quiet tint under the pointer; it opens the branch list (`BranchSearchList`) with the
  source's **Ancestors** first, nearest first, read from the source's name alone (`ancestorsOf`), then **Other
  branches**, newest first, to find by typing (`destinationGroups`), never the source. The branches are read only once
  it opens (the switcher's read). A pick is one quick `cm mergerequest edit <id> --destination=br:<branch>`
  (`setMergeRequestDestination`); the name shows at once, with a spinner while it's written. Merged and closed show it
  as text.
- **The conversation's events** (`conversationOf`, `reviewEventRow`), from the server's notes:

  | Note | Reads |
  | --- | --- |
  | `[mergerequest-status-draft-to-open]` | marked this as ready for review |
  | `[mergerequest-status-open-to-draft]` | converted this to a draft |
  | `[mergerequest-status-<any>-to-closed]` | closed this |
  | `[mergerequest-status-closed-to-open]`, `…-merged-to-open` | reopened this |
  | `[mergerequest-status-open-to-merged]6` | merged this into /main in cs:6 (the changeset a chip) |
  | `[changed-mergerequest-destination]4;19` | changed the destination from /main/release to /main |
  | `[hidden-mergerequest-branch]26`, `[unhidden-…]26` | hid the branch, unhid the branch |

  Each shows its own icon: a state move the glyph of the state it moved to, in its color; a destination the branch
  icon; hiding the eye. The notes name branches by object id: every id of a conversation is named with one
  `BranchNamesCache.resolve` (`reviewCommentsService`), none when no note names a branch. A branch deleted since keeps
  its id only, and the sentence says what it can ("changed the destination to /main", "changed the destination"). A
  move to a state this version doesn't know stays `other`, left out. These events close no round (code-reviews.md
  "Rounds"). The hidden and unhidden notes are written only by a server with merge requests switched on.
- **The merged changeset** is in no `cm find` field: only the move to Merged names it, so the page takes it from the
  conversation it reads anyway (`mergedChangesetOf`: the newest move to Merged, unless a later move took it out).
- **The cost**: opening a merge request's page runs what a review's runs (its reviewers, its email subscription, its
  branch's changesets, its conversation). Notes that name branches need their names: from what the window already
  read, at no command (the list named its rows' branches); cold (a link opened first thing, a repository's window)
  the cache reads every branch's name once, two light `cm find branch`, and keeps them ten minutes
  (`BranchNamesCache`). Should that read fail, the conversation still shows, its branches unnamed. A merged one's page also reads its branch (`branchQuery`, two light `cm find
  branch` by name, visible and hidden), to offer Hide or Unhide: no read the page makes says whether a branch is
  hidden. Nothing polls.

## The merge card (a list of sections)

After the timeline, before the comment field, in the conversation's column and not sticky (pinned to the bottom it
took the conversation's height in a short window), a merge request's card (`MergeRequestCard`) says where it stands
and what's next. `mergeCardOf` decides every line, label and action; the component renders any list it gets.

- **An ordered list of sections** (`MergeCardSection`: an id, a tone, a title, a detail, optional rows, an optional
  action at its right), then one footer action and a ⋯ menu (`MergeCard`). Each section leads with a disc: the
  Reviewed color's check (`passed`), the Rework color's cross (`failed`), a quiet dot (`pending`, `neutral`), or, for
  a section that is the state itself, the state's glyph in its color. With no footer the ⋯ ends the last section,
  rather than a footer holding only it.
- **Draft**: "Draft" / "Not ready to review or merge yet"; footer **Ready for review** (primary); ⋯ Close merge request.
- **Open**: the review section (`reviewSectionOf`, from the reviewers the review was read with, a group counting as
  one): no reviewer, "Review required" / "At least 1 approving review is required" with **Add reviewers** (the
  reviewers dialog, `chooseReviewers`); "Changes under review" / "1 pending review"; "Changes required" / "2 reviews
  requesting changes"; "Changes reviewed" / "1 approving review". Under it, only when above zero, what's open in the
  conversation ("2 change requests and 1 question open", `openItemsIn`, `openItemsLine`). ⋯ Convert to draft, Close
  merge request. No Merge button yet.
- **Merged**: "Merged into /main in cs:6" (the chip opens the changeset; without the note, "Merged into /main"), with
  **Hide branch** or **Unhide branch** once the branch's read says which (`setMergedBranchHidden`: it reads the
  branches and the reviews again, as the server may note it); neither for a branch deleted or renamed since. Footer
  **Switch to /main** while the workspace is still on the merged branch, and then no Hide branch: `cm branch hide`
  hides the workspace's own branch without a word, which would leave the workspace on a branch the lists don't show;
  switching away comes first.
- **Closed**: "Closed" / "Not merged"; footer **Reopen merge request**.
- **Ready to merge** is one rule over the sections (`mergeReadiness`: every section passed). Nothing follows it yet: it
  is the rule the card's Merge action will be made primary by, so that what joins the list later holds a merge back
  the way an unfinished review does. It will never block a merge: the server's merge rules decide.
- What the card doesn't have: checks, a build status, a merge queue, a conflicts line. No data source has them yet, so
  there is no placeholder, type or stub: each joins the list as a section of its own when its data does (read per
  page, never per row of a list), with no change to the card or its callers.

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
- **The details panel** says "Merge request" (`reviewNoun`), the state's badge with the review status's icon beside it
  (its tooltip names it: the header's room is short), and the source "into" the destination (`reviewedChangesOf`, which
  the Changes column follows too).
- **An empty list** under Active that read only merged or closed requests says none match, with Clear filters, rather
  than none yet (`isNarrowed`).

## Where a branch's merge request shows

- **Which review stands for a branch** (`reviewOfEachBranch`, every surface showing one review of a branch: the
  Branches view's and the Branch Explorer's chips, finishing a task): a merge request still to merge, over any newer
  review; else the newest. Two still to merge: the newest. It chooses among the newest `NEWEST_CODE_REVIEWS` the chips
  read (code-reviews.md "The list"): a request older than those doesn't stand for its branch.
- **The chip beside a branch's name** (`reviewChipOf`, `CodeReviewChip`, the Branch Explorer's `drawReviewChip`)
  leads the review status with the state's glyph. Narrow, it shows the state alone until the request is Open and
  reviewed, then the thumbs-up alone: at a glance, whether it can merge. The canvas draws the state as a shape of its
  own per state (a ring, dashed for a draft, a disc once merged, crossed once closed). Their tooltips name it and its
  destination (`reviewLine`). No new column and no "+N more": the list filtered by the branch shows the others.
- **The palette's** `cr:` rows show the state's glyph and "→ /main" (`codeReviewResult`, `codeReviewResultDetail`).
- **Links** to a merge request are written `…/merge-requests/12` (docs/features/deep-links.md); both words open either.
