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

## Creating one

**New merge request** (`openCreateMergeRequestDialog`, `CreateMergeRequestDialog`; what it decides is
`mergeRequestForm`, in `mergeRequestDraft.ts`) is offered by the Merge requests view's header and its empty state, the
palette in every workspace and repository window (`codeReviews.newMergeRequest`, `useMergeRequestCommands`; while the
view shows, its own, which selects the new row), and every branch's menu (`branchMenu`: the Branches view, the Branch
Explorer, the switcher, the top bar), in the `create` group above **New code review…**, which stays: a review of a
branch with no destination is still asked for, and it is the only kind a branch with nowhere to merge (`/main`) can
have. Such a branch (no ancestor in its name and no parent, `canMergeSomewhere`) has no New merge request entry,
rather than one always refused. No shortcut: creating one is rare, and the palette has it.

- **From** and **Into** sit on one row with an arrow between, read as a sentence. Each opens the branch list
  (`BranchField`, `BranchChoiceList`), the branches read only once it opens: From the branches that can merge
  somewhere, newest first (`sourceGroups`); Into the source's ancestors, nearest first (a top-level branch's parent),
  then any other branch but those made from the source (`destinationGroups`, the page's picker's). From starts on the menu's branch, else the workspace's unless it has
  nowhere to merge (`prefilledSourceOf`: most workspaces sit on `/main`), else none.
- **Into** starts on the source's **top-level ancestor** (`defaultDestinationOf`: `/main` for `/main/release/task`; a
  top-level branch's parent), where a task usually ends; the user picks another from the list.
- **Title**: the branch's own name, then " - " and its comment's first line when it has one (`defaultTitleOf`), so a
  tracker key in either survives. Both the title and Into follow From until the user changes them; a title typed and
  cleared stays empty.
- **Description** (optional; the comment editor, sharing the title's focus mode as the check-in's does) and
  **Reviewers**, picked from the server's users and groups as the code review dialog's are (`ReviewersField`, the
  review page's `ReviewerPicker`): chips with their ×, **Add**, **Remove all** once there are several. They come
  from the server's lists or its search, so an unknown name is never asked; if `cm` refuses one anyway, its
  message shows in the failure toast.
- **Create merge request**, or **Create as draft** behind its caret (`--mergerequeststatus=Draft`), its line under
  the label saying what that means: "Can't be merged until it's ready for review" (`Action.description`). The button
  says why it can't yet (`draftProblem`: no branch, a top-level one with no parent, no destination, the branch itself,
  a branch made from it (`/main/task` into `/main/task/sub`), an empty title; a top-level branch whose parent isn't
  read yet waits, refusing nothing). Into never offers a branch made from the source; `draftProblem` is the guard.
- **One command**: `cm mergerequest create br:<from> <title> --destination=br:<into> [--mergerequeststatus=Draft]
  [--users= --groups=] [--descriptionfile=<file>] --format={id}` (`createMergeRequestArgs`, `query()`), the
  description through a temp file. `cm` makes the request, then writes its description: when that fails it still prints
  the id and exits 1, so the request exists (`createdMergeRequestOf`); the toast says the description couldn't be saved.
- **`cm` checks only that the destination exists**: it makes a second request for the same branches, one from a
  top-level branch, one into the branch itself. Those are the dialog's to refuse:
  - Once From settles (`useSettledValue`), the dialog reads the branch's reviews, the read Changes shares
    (`branchReviewsKey`, one `cm find review where target = 'br:…'`). A request still to merge into the same
    destination (`existingRequestOf`, `existingRequestNote`) is named under the row with **Open it**, and Create waits,
    its tooltip saying why. A merged or closed one is a muted line that doesn't block ("Merged before: Add login"
    and **Open it**). One into another destination is no conflict. While the read runs nothing else moves: Create's
    tooltip says "Checking for an existing merge request…", and Create, if pressed, waits for the answer before
    asking (`reviewsCheckOf`, `mergeRequestForm`'s `tip`).
  - When that read fails, a muted line says "Couldn't check whether this branch already has a merge request", and
    Create still runs: a server hiccup shouldn't stop the task, `cm` creates anyway, and a duplicate shows in the list,
    where it can be closed.
  - "Close the existing request" isn't offered there: a destructive side door. Open it and close it on its page.
- Then the dialog closes, the toast says "Created merge request" with **Open**, the view selects the new row
  (`useSelectCreated`), and the reviews are read again (`isAffectedByCodeReviews`). The page doesn't open by itself,
  as a new code review's doesn't: the user may be creating several, and the toast opens it.
- **A server older than merge requests** makes a plain code review of what `cm mergerequest create` asks, and says
  nothing. The app never asks a server whether it has them: a read of the new review during that refresh (a list on
  screen, the dialog's own read of the branch's reviews: `onFirstReadOfReview`) tells, and a note says "This server
  doesn't have merge requests yet. It was created as code review 12" (`createdAs`). It runs no read of its own, and
  stops watching once the refresh is done: created from another branch's menu, with no read on screen holding it, the
  note may not come (its page, opened, shows a code review).
- **The cost**: the branch's reviews once From settles, then one create. A branch a menu or a pick from the list gives
  holds its comment and parent; only a branch named alone (the workspace's, from the view or the palette) is read for
  them (two light `cm find branch` by name, often read already by the top bar). The branch list only if a field
  opens.

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
(`mergeRequestTip`: "Open merge request into /main"). Wherever a state is named it is one look: a pill of its color
with its glyph and name (`MergeRequestStateBadge`; compact by a branch's name and in the top bar). By a branch's
name and in the top bar it is followed by its **verdict**, whether it can merge (`listedVerdictOf`, `MergeVerdictIcon`):
a check (ready), a cross (not ready), or a quiet dot while it waits (a review under way, or nobody reviews it yet),
so every Open request has a mark, the same verdict the merge
card's discs give section by section (`verdictOfSections`, which `mergeReadiness` follows). What decides it shows a
level down: the summary card and the page name each section. Lists know the review only, so it decides the verdict there; checks join as they get data read
with the list. The page, the lists' chips, the top bar, the summary card and the Branch Explorer's canvas, which
strokes the same icons (`lucideGlyphs`, `strokeGlyphOn`, `reviewChipLayout`), all show it so. A list row and the palette lead with the glyph
alone, in a column of their own. The **review status** (Under review, Reviewed, Rework required)
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

- **Its name** in the breadcrumb and a page window's title is "Merge request 72" once its review is read, "Code review
  72" until then (`pageTitle`, `usePageTitle`, which follows the page's own read and reads nothing).
- **The headline** (`reviewHeadline`): the state's badge, then the review status's, then "Ana wants to merge
  /main/task into /main"; "asked to merge … into" once merged (whoever merged it, the Merged badge says it is),
  "wanted to merge … into" once closed. Both badges stay: they say
  different things (where the request stands, where its review stands), and side by side they read as two, not noise.
- **The destination** changes in place while Draft or Open and its source branch is named (`DestinationPicker`;
  `reviewHeadline` decides): it reads as the headline's other
  branch with a small chevron, a quiet tint under the pointer; it opens the branch list (`BranchSearchList`) with the
  source's **Ancestors** first, nearest first, read from the source's name alone (`ancestorsOf`), then **Other
  branches**, newest first, to find by typing (`destinationGroups`), never the source nor a branch made from it. The branches are read only once
  it opens (the switcher's read). Unlike the new request's Into, it knows the source only by its name, not its parent:
  a top-level source (`/release`, branched from `/main`) has no ancestor there, and its parent shows under Other
  branches. A pick is one quick `cm mergerequest edit <id> --destination=br:<branch>`
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
- **Branch attributes**, last in the side rail after Notifications (`BranchAttributesSection`): the reviewed branch's
  attributes, edited in place (`AttributeChips`), as its details show them; any review of a branch has it
  (code-reviews.md "The review's page"), none with nothing to show or add. One attribute read as the page opens.
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

After the description, before the timeline, in the conversation's column and not sticky (pinned to the bottom it
took the conversation's height in a short window), a merge request's card (`MergeRequestCard`) says where it stands
and what's next. `mergeCardOf` decides every line, label and action; the component renders any list it gets.

- **An ordered list of sections** (`MergeCardSection`: an id, a tone, a title, a detail, optional rows, an optional
  action at its right), then one footer action and a ⋯ menu (`MergeCard`). Each section leads with a disc: the
  Reviewed color's check (`passed`), the Rework color's cross (`failed`), a quiet dot (`pending`, `neutral`); for
  a section that is the state itself, the state's glyph in its color. The disc is the section's verdict, whether it
  holds the merge back; its title and detail say why in words. The review statuses' own icons (a thumbs-up, a flag)
  stay where reviewers are listed (the side rail, the details' Reviewers, the timeline): there each says who asked
  what, where in a section it would only restate its title. With no footer the ⋯ ends the last section,
  rather than a footer holding only it.
- **Draft**: "Draft" / "Not ready to review or merge yet"; footer **Ready for review** (primary); ⋯ Close merge request.
- **Open**: the review section (`reviewSectionOf`, from the reviewers the review was read with, a group counting as
  one): no reviewer, "Review required" / "At least 1 approving review is required" with **Add reviewers** (the
  reviewers dialog, `chooseReviewers`); "Changes under review" / "1 pending review"; "Changes required" / "2 reviews
  requesting changes"; "Changes reviewed" / "1 approving review". Under it, only when above zero, what's open in the
  conversation ("2 change requests and 1 question open", `openItemsIn`, `openItemsLine`). Then, in a workspace, its
  conflicts with the destination ("Conflicts with the destination" below). Footer **Merge into main…** ("Merging"
  below); ⋯ Convert to draft, Close merge request.
- **Merged**: "Merged into /main in cs:6" (the chip opens the changeset; without the note, "Merged into /main"), with
  **Hide branch** or **Unhide branch** once the branch's read says which (`setMergedBranchHidden`: it reads the
  branches and the reviews again, as the server may note it); neither for a branch deleted or renamed since. Footer
  **Switch to /main** while the workspace is still on the merged branch, and then no Hide branch: `cm branch hide`
  hides the workspace's own branch without a word, which would leave the workspace on a branch the lists don't show;
  switching away comes first.
- **Closed**: "Closed" / "Not merged"; footer **Reopen merge request**.
- **Ready to merge** is one rule over the sections (`mergeReadiness`: one passed, and every other passed or neutral, a
  section that says nothing yet). The card's Merge is primary when it holds and quiet before, so that an unfinished
  review or conflicts hold a merge back. It never blocks a merge: the server's merge rules decide.
- What the card doesn't have: checks, a build status, a merge queue. No data source has them yet, so there is no
  placeholder, type or stub: each joins the list as a section of its own when its data does (read per page, never per
  row of a list), with no change to the card or its callers.

## Conflicts with the destination

An Open request's card says whether its branch merges cleanly into its destination (`conflictsSectionOf`), from the
merge page's own preview: `cm merge br:<source> --to=br:<destination>` without `--merge`, which changes nothing
(`MergeApi.conflictCounts`, `countMergeConflicts`). A preview that prints nothing at all (`cm` always names the
merge's contributors, even with nothing to merge) is no answer, never "no conflicts".

- **Process, not shell.** The card's preview runs in a process of its own (`executeRecords`); the merge page's same
  preview runs in a pooled `cm shell` (`readMergePlan`). Each is where its wait goes: the card's runs in the background
  of a page someone is reading, and for the second or so it can take it would hold one of the workspace's two pooled
  sessions the page's own reads (its conversation, its changes) go through; on the merge page the preview is what the
  user is waiting for, and a process would only add its start-up (100 to 150 ms).

- **Only when asked.** The preview takes 1.2 to 1.6 s on a big repository (measured on one of ~280k changesets, three
  runs each on two requests' branches, `cm` starting included), too much to run each time a request's page opens. So
  the section starts as "Conflicts with main" / "Not checked yet" with a quiet **Check**; running it by itself was
  rejected for that cost. While it runs: "Checking for conflicts with main…".
- **What it says.** None: "No conflicts with main" / "Merging can be done automatically" (passed). Some, counted as
  the merge page groups them (File conflicts, Directory conflicts), with **Resolve…**, which opens the merge page
  (`openMergeRequestMerge`):
  - Only files: "3 file conflicts with main" / "Some may merge automatically" (pending). A file changed on both sides
    may merge automatically on the merge page, which finds out by merging the three revisions' text
    (`mergedAutomatically`); the preview's records don't say, and reading every file's text for a card was rejected.
  - Any directory conflict: "3 file conflicts and 1 directory conflict with main" / "Resolve them to merge" (failed):
    a directory conflict always needs a decision.
  A check that fails, or a merge with nothing left to merge, shows no section. Conflicts hold Merge back
  (`mergeReadiness`); Check and Checking say nothing (neutral) and don't.
- **When it runs** (`conflictsCheckRequest`, `useMergeRequestConflicts`): an Open request of a named branch, in a
  window with a workspace (the preview runs in one; a repository's window shows no section), its Conversation tab
  shown (`ViewShownContext`), once asked on that page. **Check** first reads the destination's head again (its branch,
  `branchQuery`: `cm find branch`, visible and hidden), as a kept head may be behind; then the merge is keyed by both
  heads, the source's from the changesets the page reads anyway (`useReviewChangesets`), and kept (`IMMUTABLE_QUERY`,
  `mergeConflictsKey`). So Check answers at once from what's kept when neither head moved, and a check-in that moves
  either checks again, once, while the page stays asked. Nothing runs on a Draft, Merged or Closed request, nor in a
  list.
- **Per visit** (`conflictsCheckOf`): until Check is clicked on this page the section says "Not checked yet", even
  with an answer or a failure kept from an earlier visit (the branches may have moved). A failure (the preview, or the
  destination unread or gone) hides the section for that visit only; the next Check runs a failed check again.
- **Refresh** on the page reads the destination's branch again only for an Open request whose conflicts were checked
  in the window (`refreshedDestinationOf`, `conflictsCheckedIn`), so a check-in there from another client checks them
  again; a request never checked costs no branch read.

## Merging

There is no "merge this merge request" command: its branch is merged into its destination by an ordinary merge on the
server, the merge page finishing a task (docs/features/merge.md "Finishing a task").

- **Merge into main…** (the ellipsis as the merge page confirms it) is offered for an **Open** one whose branch is
  named, one rule for the card's footer and the row's and the page's menus (`mergeOfRequest`; the menus'
  `mergeIntoOf`, the `mergeInto` word in the `merge` group; the top bar's card once reviewed). It opens the merge page into the request's destination, not the branch's parent
  (`openMergeRequestMerge`), with the request named under the comment and its title starting the comment.
- **The button never waits for the review.** Primary once ready (`mergeReadiness`), the default quiet button before,
  same place, same words: no warning color, no "anyway". The server's merge rules are the authority; blocking until
  Reviewed (with an admin bypass) was rejected, as the app would guess the rules wrong and an unreviewed request
  could never merge on a server without such a rule. A window with no workspace has no merge page: there the card's
  button is disabled, its tooltip "Open a workspace of this repository to merge", and the menus don't offer it.
- **The app records Merged itself.** A server with merge requests switched on marks the Open requests from that
  source into that destination Merged on the merge's check-in; one with them off never does, and `cm` can't ask which
  it is. So after any merge on the server that finishes a task and made a changeset (from the request, Changes or the
  branch menu alike), `finishMergedTask` records each Open request of the branch into that destination
  (`requestsToRecord`; usually one) with one quick `cm mergerequest edit <id> --mergerequeststatus=Merged
  --mergechangeset=cs:N` (`recordMerged`, `query()`; `cm` takes one id per edit). The branch's reviews are the merge
  page's (`branchReviewsQuery`); a merge clicked before they arrived reads them once then. Setting it again on a
  request already Merged changes nothing and adds no note, so it's safe on both. It comes first, then the user's
  review and hiding the branch. Should the write fail (a server that marked it may refuse it to someone else than its
  owner), the request is read once (`find review where id`): already Merged, nothing is said; else "Merged, but
  couldn't mark the merge request as merged", and nothing is undone. The reviews are then read once (the page, the
  lists, the chips), after every write: the merge's own refresh leaves them out (`mergeRefreshScope`).
- **The gap**: a branch merged into a workspace and checked in (a merge the app doesn't finish as a task) records
  nothing; on a server with merge requests switched off its request stays Open until someone closes it.
- **Merge rules.** A server may refuse the merge for its rules, and does so while the merge page calculates the merge,
  so the preview says it (`MergeRuleRefused`): "This server merges into main only reviewed branches" with **Open merge
  request** (the request the merge was opened from, else the branch's still to merge into that destination,
  `mergeRequestInto`), and "This server merges into main only branches with an open merge request" with **Create
  merge request** (the dialog, from the source branch: `openCreateMergeRequestDialog`). They're recognized
  by `cm`'s English text, the branch names taken from their quotes (`mergeRuleRefusal`); a message in another language
  or any other failure shows `cm`'s own words, as before.

## One view: Merge requests

The sidebar's **Merge requests** (view id `codeReviews`; links `merge-requests`, and `code-reviews`, its older name,
still opens it) lists merge requests and code reviews together: a review of a changeset or a shelve, or of a branch
with no destination, is the rarer sibling, not another feature. Two lists of the same object (a Merge requests view
beside Code reviews) were rejected: two badges, and "where is my review of that branch?".

- **The row** leads with what it is, in a fixed-width slot: a merge request's state glyph, or the code review glyph;
  then the title, never a number ("Its number"; `codeReviewColumns`), as pull requests read. The text filter still
  finds a review by it. In a narrow column right after the title, with no header, an icon says where it stands, as
  by a branch: a merge request its verdict (a check, a cross, a quiet dot while it waits; its state already leads
  the row), a code review its review status's icon, each named by its tooltip (`reviewStatusCellOf`). The marks line up,
  and the room a Status column of words took goes to the title. The Status chip still filters by the review's status, for both kinds.
- **Changes** says `task → main` for a merge request: the source gives way when narrow, the arrow and the destination
  stay whole (the destination is usually short). Its tooltip: "Merge /main/task into /main".
- **The Kind chip** (`kind`, `ReviewKindFilter`): **Any kind**, where it rests, or **Merge requests** or **Code
  reviews** alone (`matchesKind`), narrowed locally from the same read: switching it runs no command. With Code reviews
  alone the State chip hides and its state is left out of the read (`stateUnderKind`, `showsStateChip`): a code
  review has no state.
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
- **The details panel** says "Merge request" (`reviewNoun`) and the state's badge, its verdict left to the Review
  section under it (`reviewStatusCellOf`; a code review, its status's badge), its number to copy, and the source "into" the destination
  (`reviewedChangesOf`, which the Changes column follows too), said once: its Changes property names the branch alone.
  Under it (`reviewDetailsSections` decides): **Review**, where the review stands as the request's summary says it
  (`ReviewStanding`; when the summary says it); **Reviewers**, each with the status they gave
  (`ReviewerList`, read only: the page changes them); **Branch attributes**, the reviewed branch's, edited in place
  (`AttributesDetailsSection`, one attribute read per selection, as a branch's details make; hidden with nothing to
  show or add). A code review of a branch has the
  last two; of a changeset or a shelve, its reviewers only. The description stays on the page: reading it is the
  conversation's read, too much for a selection.
- **An empty list** under Active that read only merged or closed requests says none match, with Clear filters, rather
  than none yet (`isNarrowed`).

## Its number

A merge request is named by its title and its branch, never by its number, wherever it shows by a branch or in a list:
the branch already has a name, and a second id to remember is one too many. So the list's rows, the branch chips, the
top bar, their cards, the next step in Changes, the new request's dialog and the toasts leave it out. It shows where
the request itself is the subject: its details panel (to copy), its page's name ("Merge request 72") and its links.
A plain code review keeps its number where it is named alone (a toast, its page, its tooltip); in the list it goes by
its glyph and title too.

## A branch's merge request at a glance

One card says where a merge request stands, wherever it shows by its branch (`MergeRequestSummaryCard`;
`mergeRequestSummaryOf` decides): the top bar's hover card, the hover card of a branch's chip in the Branches view and
the Branch Explorer, and the **Merge request** section of a branch's details (both views). It holds the title (a link
that opens the request, in every one of them: the Branch Explorer's stays where it opened for the pointer to move
in, `pointerCardStays`), "Ana wants to merge into /main" (`mergeVerbOf`:
"asked to" once merged, "wanted to" once closed), the state's badge and, under a rule, where the review stands in the
merge card's words (`reviewSectionOf`): while Open, and once merged if the review was decided (reviewed, or changes
required: it merged whatever the review said); never for a draft or a closed one. One frame and width wherever it
stands alone (`.framed`). It reads nothing: it is drawn from the review the branch's chip already holds (`reviewOfEachBranch`).

## Where a branch's merge request shows

- **Which request counts for a branch**: two rules, both in `reviewsByBranch.ts`, both over reviews listed newest
  first, both putting a merge request still to merge (the newest of two) first. They differ in what comes after it, as
  they answer different questions:
  - **The review that stands for a branch** (`reviewOfEachBranch`, `reviewStandingFor`), for any branch in a list:
    the Branches view's and the Branch Explorer's chips, finishing a task. Else the newest review of any kind, plain
    or closed too: the chip shows where the branch's latest review stands. It chooses among all of the branch's
    reviews ("Reading the branches' reviews").
  - **The request current on the workspace's branch** (`currentRequestOf`), for the top bar and the next step in
    Changes. Else the newest merged request, which says the branch is finished work and where it went; never a closed
    one or a plain code review, which say nothing about where the task merges.
- **Reading the branches' reviews**: only for the branches a view shows, in blocks, as the official client does
  (`useBranchReview`, `useBranchReviews`, `branchReviewQuery`), once the view stays put: a scroll or a pan asks for
  nothing on its way. The Branches view asks for a row once it stays drawn (`useSettled`; the rows in view and the
  table's overscan); the Branch Explorer for the branches whose headers are in view or within half a view of it, once
  the view settles (`branchesNearView`, reported by the canvas after each frame and settled by `useBranchesNearView`),
  and for none while zoomed out past where it draws headers, as no chip shows there; a branch's details for its
  branch. Each branch is a query of its own, kept and rarely read again (`SLOW_CHANGING_QUERY`), null when the
  branch has no review, so a branch is read once whichever view asks. What is asked in one turn is read together
  (`batchLoader`, one per place): one `cm find review "where (targetid = 37 or targetid = 41 …) and targettype =
  'branch' order by date desc"` (`branchTargetsCondition`, `query()`) per block of `BRANCH_REVIEWS_BLOCK` (50), one
  block at a time, never several at once, the newest asks first; a branch that left the view before its block is
  dropped from it (its query's abort signal). A move or a read of a review shows in its branch's chip at once, as in
  the lists (`withStandingReviewUpdated`). The server matches the ORed `targetid`s in one scan of its reviews, so a
  block costs what one branch does (on a repository of ~6,700 reviews: 1.2 s for 50 or for 1 with `cm` starting,
  about 0.2 s through the shell); `target = 'br:<name>'` ORed was rejected, as the server resolves each name (4.2 s
  for 50). Reading every review once (about 2 s, 540 KB there) was rejected too: it reads what no view shows, and a
  bound by date would leave older branches unread. A Refresh or a write on a review reads again the branches still
  shown, in blocks. Scrolling back to branches read costs nothing.
- **The chip beside a branch's name** (`reviewChipOf`, `CodeReviewChip`, the Branch Explorer's `drawReviewChip`)
  names a merge request's state in its pill ("Open"), then its verdict (a check, a cross, a quiet dot while it waits;
  none for a draft, a merged or a closed one). A code review's chip shows its
  status's pill. Narrow, the names go and the glyphs stay. The canvas draws the very same pill and icons. Hovering a merge request's chip shows its
  summary card ("A branch's merge request at a glance"); a code review's, a tooltip naming it (`codeReviewLine`);
  `reviewChipOf` decides which (`hover`). No new
  column and no "+N more": the list filtered by the branch shows the others.
- **The top bar** (`MergeRequestChip`, a segment of the branch pill before the incoming one, sized as it): when the
  workspace's branch has a merge request, its state's compact pill ("Open") and its verdict, as by every branch; never its number ("Its number"). Which one: `currentRequestOf` ("Which request
  counts for a branch"); a merged one says Merged, telling the user they're still on finished work. Below 820px the
  state's name goes and the glyphs stay, before the branch pill gives up any room. A click opens it.
  - **Hovering** shows a card: the request's summary (`MergeRequestSummaryCard`, "A branch's merge request at a
    glance"), its title a link that opens it; then, while Open, what's still open ("2 change requests and 1 question
    open", `openItemsLine`); then **Merge into main…** once an Open one is reviewed (`mergeOfRequest` with the
    workspace's branch as the source; `mergeRequestChipOf` decides). No Open button: the title is the link, and the
    card never offers the quiet button the merge card does, as it only says where things stand. The card opens on
    hover only, so a keyboard doesn't reach it: Enter on the chip opens the page, which shows all of it. A screen
    reader hears what the chip shows ("Merge request · Open into /main · Ready to merge: Dash"; "Waiting for review"
    while it waits), no verdict where it shows none.
  - **The cost**: the branch's reviews are one `cm find review where target = 'br:<branch>'` (`branchReviewsQuery`),
    the read Changes makes for the change requests a check-in applies, so the two share it. Asked once the
    workspace's branch is known and the first screen is in (the pending changes read, or failed: the sidebar's count
    reads them in any view), so it never competes with a window's first reads; never on a changeset, label or shelve
    (`asksForBranchReviews`); rarely read again
    (`SLOW_CHANGING_QUERY`: a focus reads nothing), again on a write on a review, a check-in, an update or a switch.
    The query is keyed by the workspace's branch (`keyedByWorkspaceInfo('selector')`), so a switch, in the app or in a
    terminal, reads the new branch's reviews once. The conversation, for what's still open, is read only as the card
    shows an Open request the server counts something open on (`cardReadsOpenItems`), under the key the page and the
    check-in read it by. Nothing polls. A repository's window has no branch, so no chip.
- **Changes**, on a clean workspace on the branch: the task's next step, by its merge request: Create, Ready for
  review, where its review stands, Merge into main… once reviewed (docs/features/merge.md "The next step, in Changes").
  The same read of the branch's reviews, no command of its own.
- **The palette's** `cr:` rows show the state's glyph and "→ /main" (`codeReviewResult`, `codeReviewResultDetail`).
- **Links** to a merge request are written `…/merge-requests/12` (docs/features/deep-links.md); both words open either.

## Where the merge card sits, and why

At the top of the conversation, after the description: what it is, then where it stands and what's next, then its
history. The page's header already shows the state and the review's badges; the description says what is asked. At
the bottom, after the timeline (as pull requests long had it), a long conversation hid where the request stood; above
the description, it came before the user knew what the request was. A long description pushes it down: folding long
descriptions is the answer if that bites, not moving the card above them.
