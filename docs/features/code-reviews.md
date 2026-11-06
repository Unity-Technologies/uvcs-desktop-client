# Code reviews

A code review asks people to review a branch, a changeset or a shelve. A merge request is the same object on the
server, with a destination branch: what this doc says of reviews holds for both.

Reviews need `cm` 11.0.16.10616 or later: the fields `cm find review` reads (`FOUND_REVIEWS`) and the reviewer
commands are that version's, and with `--format` a field an older `cm` doesn't know fails the whole command, so the
list, the branch chips and the palette's reviews would read nothing. The app doesn't check the version yet.

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
  `cm codereview reviewer add <id> --users=a,b`. Groups are shown as reviewers but can't be added from the app yet
  (`--groups`). A new review asks its reviewers in the command that creates it
  (`cm codereview <target> <title> --users=a,b`, `createReviewArgs`).
- Finishing a task can mark the user's review as reviewed once merged (docs/features/merge.md, `canMarkReviewed`).
- `cm codereview -e --status` isn't used: it sets the status of the review's first reviewer, and fails on a review
  with more than one.

## The list

- One `cm find review` reads each review with its reviewers and the status each gave (`{reviewers}`,
  `name:Status` pairs, `parseReviewers`; a group's name reads as a user's), the number of comments (`{comments}`: comments, questions, change requests
  and their replies) and of open ones (`{unresolvedissues}`: change requests neither applied nor discarded, questions
  with no reply), and the last activity (`{modifieddate}`). `{codereviewstatusname}` prints the status in English
  whatever the client's language; `{status}` translates it (`FOUND_REVIEWS`).
- Columns: the title, the status, the reviewers (`ReviewerStack`: each avatar ringed in the color of its reviewer's
  status, the tooltip naming each with theirs), the comments with how many are open (`ReviewCommentCounts`; sorted
  by what's open first, `commentCountsSortValue`), the changes, the author, when it was created (the list's order and
  its period go by it; hidden in a narrower window) and the last activity.
- **I'm a reviewer** keeps the reviews the user is a reviewer of: `where reviewer = 'me'`, which `cm find`'s help
  doesn't list but the official client uses.

## The review's page

- The header: the title (the pencil edits it in place, `ReviewTitle`; `cm codereview -e --title`, and the server
  notes the rename), the status, who wants a review of what, the reviewers, and **Your review**. Then two tabs
  (`ui/Tabs`): **Conversation**, with the number of comments, and **Changes**, the reviewed diff. The page names the
  tab it shows (`PageOf<'codeReview'>.tab`, `openingTab`): the conversation, unless it names a file (`focusPath`,
  a link's `/-/files/<path>`), which the changes show. Picking a tab shows the page with it in place
  (`navigation.replacePage`), so Back leaves the review, and the page's link follows it: the review alone on its
  conversation, the review and its file on its changes (`pageLinkTarget`).

## The conversation

- One `cm find changereviewcomment "where reviewid = N order by date asc"` reads everything said on a review
  (`FOUND_REVIEW_COMMENTS`, `conversationOf`): the comments, each with its kind (`ReviewCommentKind`), the comment it
  replies to (`{parent}`), where it is (`{revisionid}`, `{itemid}`, `{path}`, `{line}`, `{changeset}`), when it was
  edited (`{modifieddate}`, the creation date when never edited) and the changeset that applied a change request
  (`{appliedinchangeset}`). The server writes its own notes among them (`timeline`), their meaning in a prefix of the
  text: the description is the newest `[description]` one; the others are events (`ReviewEvent`): review requests
  (`[requested-review-from]a;b`; an older server's `[requested-review-from-<id>]` names no one), a reviewer asked
  again or removed, a status with what its reviewer said (`[status-reviewed]…`), a rename (`[renamed-title]a#->#b`).
  What this version doesn't read yet (a merge request's statuses) shows its text (`other`).
- It reads under the reviews' area (`useReviewConversation`), so every write on a review reads it and the lists again,
  their counts changing with it (`isAffectedByCodeReviews`), and a focus once stale reads it, as others write on it.
- The tab (`ReviewConversationTab`) shows, oldest first as a conversation reads: the description (edited in place;
  an emptied one clears it, `cm codereview -e --descriptionfile`), then the threads and the events by when each
  started (`timelineOf`), then a field for a comment on the whole review (`cm codereview comment add`). Beside it,
  the reviewers with the status each gave and **Open**: the change requests and questions still open, a click
  scrolling to each (`ReviewSideRail`).
- A thread (`threadsOf`, `ReviewThreadCard`) is a comment and its replies. A reply whose comment another client
  deleted starts a thread of its own. One on a line shows its file and line first, a click opening the Changes tab
  there (`commentLocationPage`), then its kind and where it stands (`threadBadges`), as the server counts open ones:
  a change request is **Open** until a changeset applies it (**Applied in** its changeset, a chip) or a reply discards
  it (**Discarded**); a question is **Open** until anyone replies (**Answered**: any reply answers it, there's no
  other way to resolve one). Other comments are never open.
- Writing: every comment is written in the rich editor (docs/features/rich-comments.md) through `CommentComposer`,
  ⌘↵ sending it, its draft kept while the window lives (`useCommentDraftStore`) and cleared once sent; each text
  reaches `cm` in a file. Reply (`cm codereview comment reply`), edit (`… comment edit`, the text only), delete
  (`… comment delete`, asked first), discard a change request with a reply saying why (`… reply --discard`).
- Who may do what (`commentPermissions`), as the official client allows it (the server only checks the permission
  on what the review targets): only its author edits a comment; only its author deletes it, and a thread's first
  comment only while nobody replied (`cm` would leave the replies answering nothing); anyone but who asked for it
  discards an open change request. A comment's menu (`commentMenu`) offers what the user may do, and its text to copy.
