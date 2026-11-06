# Code reviews

A code review asks people to review a branch, a changeset or a shelve. A merge request is the same object on the
server, with a destination branch: what this doc says of reviews holds for both.

## Reviewers and their status

- A review has **reviewers**, users or groups, each with the status they gave: Under review, Reviewed or Rework
  required (`CodeReviewer`, `CodeReviewSummary.reviewers`). The server derives the review's own status from theirs:
  Rework required when anyone asks for it, Reviewed once everyone has, Under review otherwise, and Under review with
  no reviewers. The app never sets the review's status: each reviewer sets their own.
- **Your review** (the page's control, the menu's "Your review" submenu, `setOwnReviewStatus`) sets the signed-in
  user's status with `cm codereview review <id> --reviewed | --rework-required | --under-review`, with what they say
  about it in a file (`-commentsfile`) when there is something. Only reviewers give a status: a user who isn't one yet
  is asked first ("You'll be added as one") and added with `cm codereview reviewer add` before their status is set.
  Whether the user is a reviewer goes by name (`isReviewer`, `ownStatus`): a member of a reviewer group isn't known to
  be one, so they are added as a user, as the server does itself when a group member sets a status.
- **Add reviewers** (`addReviewers`) asks the users typed, separated by commas (`reviewerNames`), with one
  `cm codereview reviewer add <id> --users=a,b`. A new review asks its reviewers in the command that creates it
  (`cm codereview <target> <title> --users=a,b`, `createReviewArgs`).
- Finishing a task can mark the user's review as reviewed once merged (docs/features/merge.md, `canMarkReviewed`).
- `cm codereview -e --status` isn't used: it sets the status of the review's first reviewer, and fails on a review
  with more than one.

## The list

- One `cm find review` reads each review with its reviewers and the status each gave (`{reviewers}`,
  `name:Status` pairs, `parseReviewers`). `{codereviewstatusname}` prints the status in English whatever the client's
  language; `{status}` translates it (`FOUND_REVIEWS`).
- The Reviewers column shows each reviewer's avatar ringed in the color of their status, the tooltip naming each with
  theirs (`ReviewerStack`).
- **Assigned to me** keeps the reviews the user is a reviewer of: `where reviewer = 'me'`, which `cm find`'s help
  doesn't list but the official client uses.
