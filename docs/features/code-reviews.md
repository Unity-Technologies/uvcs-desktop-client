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
- Each status has its icon wherever it shows (`REVIEW_STATUS_ICONS`, the official client's): an eye under review, a
  flag for rework required, a thumbs-up once reviewed, in the status's color.
- **Your review** (the page's button, `OwnReviewButton`; the menu's "Your review" submenu; `setOwnReviewStatus`) sets
  the signed-in user's status with `cm codereview review <id> --reviewed | --rework-required | --under-review`, with
  what they say about it in a file (`-commentsfile`) when there is something; a comment is sent even with the status
  they gave already. The button reads their status, or Review when they aren't a reviewer (`ownReviewButton`). Only
  reviewers give a status: a user who isn't one yet is added with `cm codereview reviewer add` before their status is
  set, the page's popover saying so, the menu asking first ("You'll be added as one").
  Whether the user is a reviewer goes by name (`isReviewer`, `ownStatus`): a member of a reviewer group isn't known to
  be one, so they are added as a user, as the server does itself when a group member sets a status.
- **Groups** are reviewers as users are: picked, shown, removed and asked again. `cm find review` prints a reviewer's
  name only (`{reviewers}`, the same for a user and a group). `cm codereview reviewer list <id> --format` prints each
  one's type (`{user}`, `{status}`, `{type}`: `user` or `group`, never translated; `LISTED_REVIEWERS`), one review at a
  time: the review's page reads it for its review (`CodeReviewsApi.reviewers`, `useReviewersOf`, one command read
  with the page's other reads and again whenever the reviews are; never per row of a list, nor for a review with no
  reviewers, `readsReviewerTypes`), and so does the list's Change reviewers dialog for the review it opens on, its
  picker waiting for it (`dialogPick`). It is read even where the server's groups answered: a name missing from that
  list (a server that lists none, a group made since it was read) can't be told from a user, and the page's writes
  must name each one as `cm` takes it. Where that type is read (`CodeReviewer.kind`), it decides: the
  page's Reviewers, its picker, Remove and Ask to review again name a group as one on any server, one that lists no
  groups too. Elsewhere (the list's stack, the picker's offered groups, the new-review dialog) the server's groups
  (`cm listusers <server> --onlygroups`, read once and kept, the list Permissions and the picker read too:
  `useReviewerGroups`, `reviewerGroups`) tell a group from a user by name, whatever its case (`isGroup`,
  `reviewerRef`). A group shows the group icon where a user shows their avatar
  (`GroupAvatar`: the reviewers' stack, the review's page, the picker), its name as the server writes it
  (`reviewerLabel`), and its tooltip says it's a group (`reviewerText`). Every command names a group in `--groups` and
  a user in `--users`, both in one command when both change (`reviewersOptions`): `cm` looks a name up among its
  option's kind only, and a group in `--users` fails ("No such user"). On a server that lists no groups (one that
  takes the names its system knows), or whose directory refuses the whole list (a size limit), the list's stack shows a
  group reviewer as a user (only its page knows better), and the picker finds groups only by a search, adding one as a
  group. A refused list
  is asked once, not again by each row that shows reviewers (`MEMBER_NAMES_QUERY`, `retryOnMount: false`). A user and
  a group of the same name read as the group.
- **Picking reviewers** (the gear beside the page's Reviewers, `ReviewerPicker`) lists the server's users and groups
  (`cm listusers --onlyusers` and `--onlygroups`, each read once and kept, `useMemberNames`): the reviewers checked
  first, then the groups, then the users, each by name (`offeredReviewers`), as the official client lists them. What
  changed applies as it closes (`pickChanges`, `changeReviewers`): one `cm codereview reviewer add <id> --users=a,b
  --groups=g`, one `cm codereview reviewer remove <id> --users=c`. Under the pointer each reviewer can be removed, or,
  once they gave a status, asked to review again (`canReRequest`, never the user themselves; `cm codereview review <id>
  --re-request --users=a` or `--groups=g`, which puts them back to "Under review"). What the picker changes is worked
  out against the reviewers as it opened (`ReviewerPick`, `pickChanges`), so someone another person added meanwhile
  isn't removed; the reviewers it opened with are a group or a user as "Groups" says (their type from `cm` where it
  was read, else the server's groups as it applies), and someone checked keeps the kind they were listed with
  (`pickedKind`). A server whose directory can't list everyone (an LDAP size limit) is
  asked for the names typed instead (`--filter`), users and groups alike (`useServerMembers`, `memberListing`), the
  note under the rows saying which can't be listed (`pickerFooter`). The author can be a reviewer, marked
  **Author** (`isAuthor`). The list's **Change reviewers** (`chooseReviewers`) opens the same picker in a dialog
  (`ReviewersDialog`, `pickReviewers`), saved with one command to add and one to remove; it is offered for one review
  at a time, as the picker shows that review's reviewers (adding to several reviews would be a command per review).
  A new review asks the reviewers typed, separated by commas (`typedReviewers`, a group as one), in the command that
  creates it (`cm codereview <target> <title> --users=a,b --groups=g`, `createReviewArgs`).
- Finishing a task can mark the user's review as reviewed once merged (docs/features/merge.md, `canMarkReviewed`).
- `cm codereview -e --status` isn't used: it sets the status of the review's first reviewer, and fails on a review
  with more than one.

## The list

- One `cm find review` reads each review with its reviewers and the status each gave (`{reviewers}`,
  `name:Status` pairs, `parseReviewers`; which are groups, the server's groups say: see "Groups"), the number of comments (`{comments}`: comments, questions, change requests
  and their replies) and of open ones (`{unresolvedissues}`: change requests neither applied nor discarded, questions
  with no reply), and the last activity (`{modifieddate}`). `{codereviewstatusname}` prints the status in English
  whatever the client's language; `{status}` translates it (`FOUND_REVIEWS`).
- Columns: the title, the status, the reviewers (`ReviewerStack`, from `stackedReviewers`: their avatars stacked in
  `ui/AvatarStack`, three then a "+N" disc whose tooltip names the rest; hovered, the stack spreads and each avatar
  shows its reviewer's status as a badge in its corner, the status's icon in its color (`reviewerBadge`,
  `REVIEW_STATUS_ICONS`: an eye, a flag, a thumbs-up), fading in as the avatar settles, and its tooltip names them with
  it, `reviewerText`; at rest the stack shows only who, the Status column saying where the review stands (the keyboard
  never spreads it: a sighted keyboard user reads each reviewer's status on the review's page, beside its conversation,
  where every reviewer shows their status's icon); the details panel shows the same; the column is `REVIEWERS_COLUMN_WIDTH`, wide enough for the stack spread), the
  comments with how many are open (`ReviewCommentCounts`; sorted by what's open first, `commentCountsSortValue`), the
  changes, the author, when it was created (the list's order and its period go by it; hidden in a narrower window) and
  the last activity.
- **I'm a reviewer** keeps the reviews the user is a reviewer of: `where reviewer = 'me'`, which `cm find`'s help
  doesn't list but the official client uses.
- The list reads every review its filters keep (the time range, Last 3 months by default, who created them, the
  status, I'm a reviewer), with no cap (`CodeReviewFilter.limit` unset), as the other lists do: its text filter, which
  looks through each row's number, title, target and people (`reviewFilterTexts`), then finds any review in the range,
  and "No matching code reviews" hints a longer one. A large repository (about 6,600 reviews) reads all of them, Any
  time, in one `cm find` of about 1.5 MB, under a second; their branches are named from the names of every branch, read at
  most once (`BranchNamesCache`). The palette and the branch chips read only the newest `NEWEST_CODE_REVIEWS`
  (`reviewSummariesQuery`). The palette finds an older review by its title (`cm find review … like`) or its number,
  typed alone or after `cr:` (one `cm find review "where id = N"` once typing pauses; ARCHITECTURE.md "Prefixes").

## The review's page

- The header, two rows: the title (the pencil edits it in place, `ReviewTitle`; `cm codereview -e --title`, and the
  server notes the rename), at its end the reviewed code to the workspace, **Your review** and the page's menu
  (`reviewPageMenu`: a new window, Copy, Delete; what the page shows already has its own control, and deleting stays
  out of the way); then the status, who wants a review of what and when. The reviewers are beside the conversation,
  not in the header. Then two tabs
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
- The tab (`ReviewConversationTab`) shows, oldest first as a conversation reads: the description (its band in the
  accent's tint, apart from the comments' neutral ones, saying who "wrote the description" or "opened the review",
  `descriptionHeader`; edited in place;
  an emptied one clears it, `cm codereview -e --descriptionfile`), then the threads and the events by when each
  started (`timelineOf`), then a field for a comment on the whole review (`cm codereview comment add`). Oldest first
  is deliberate: replies and events only read in order (requested, commented, applied), and newest first would
  scatter them; what's new is reached from **Open** and by settled threads folding. Three or more reviewer changes in
  a row (asked, asked again, removed) read as one line that lists each on a click (`foldReviewerChanges`). What its
  author did to themselves reads so ("added themselves as a reviewer", "left the reviewers"). Beside it, the
  reviewers (see "Reviewers and their status") and **Open**: the change requests and questions still open, a click
  scrolling to each (`ReviewSideRail`).
- A thread (`threadsOf`, `ReviewThreadCard`) is a comment and its replies. A reply whose comment another client
  deleted starts a thread of its own. One on a line shows its file and line first, a click opening the Changes tab
  at the thread, in the mode it was written in (`commentLocationPage`: `focusThread`, and `focusChangeset` for one
  written changeset by changeset; see "Comments in the code"). Its
  header is one quiet line: its kind's icon, its folder (giving way first in a narrow card), file and line
  (`locationText`), and where it stands in words (`threadBadges`), as the server counts open ones: a change request
  is **Open** until a changeset applies it (**Applied in** its changeset, the pill a link to it) or a reply discards it
  (**Discarded**); a question is **Open** until anyone replies (**Answered**: any reply answers it, there's no other
  way to resolve one). Other comments are never open. A settled thread starts folded to that line and its first words
  (`startsFolded`, `repliesText`), so what's open stands out; a click shows it whole. Where it stands is an outlined pill:
  **Open** in the color of "Rework required", **Applied in** and **Answered** in the color of "Reviewed",
  **Discarded** neutral.
- Writing: every comment is written in the rich editor (docs/features/rich-comments.md) through `CommentComposer`,
  ⌘↵ sending it, its draft kept while the window lives (`useCommentDraftStore`) and cleared once sent; each text
  reaches `cm` in a file. Reply (`cm codereview comment reply`), edit (`… comment edit`, the text only), delete
  (`… comment delete`, asked first), discard a change request with a reply saying why (`… reply --discard`).
- Who may do what (`commentPermissions`), as the official client allows it (the server only checks the permission
  on what the review targets): only its author edits a comment; only its author deletes it, and a thread's first
  comment only while nobody replied (`cm` would leave the replies answering nothing); anyone but who asked for it
  discards an open change request. A comment's menu (`commentMenu`) offers what the user may do, and its text to copy.

## Comments in the code

The Changes tab (`ReviewChangesTab`) shows what was said on the code where it was said, from the conversation already
read (`useReviewConversation`): no other `cm` read, but the earlier versions of a file below.

- **Where a thread goes** (`threadsOfFile`, `fileCommentsOf`). A comment is on a line of one revision of a file
  (`{revisionid}`, `{line}`), found in the diff by its path or the path the file moved from. On the revision the
  diff's newer side shows, it sits under its line; on the one its older side shows (a file the review deletes, which
  `cm` comments on its last revision), under that line on the left. On an earlier version of the file (the reviewer
  commented at cs:8, the author checked in cs:9 and cs:10), that version and the newer side are read
  (`versionsToRead`, `useFileVersionTexts`: one immutable read each, only for a file shown that has such threads), and
  the line is followed into the newest version (`newerLineOf`, a line diff ignoring line ends): unchanged, the thread
  sits at its line there, tagged **Earlier version**; changed or gone, it is **outdated**, gathered above the code
  ("2 outdated comments", folded), each with the lines it was written on (`snippetOf`) (`earlierTagOf`). Why not the
  official client's banner (Revision with comments, Last in branch, Diff with head): most comments still sit on code
  that didn't change, and those read best in place; the rest are what GitHub calls outdated, and its way of showing
  them is known.
- **See in context**, a button on each thread on an earlier version (outdated, or tagged Earlier version), opens a
  dialog (`openCommentContextDialog`, opened through `useCommentContext`) with two views, each the file's diff with the
  thread at its line (`commentContext`): **When commented**, the diff it was written on, as its author saw it (the
  older side of the diff it was written in, `contextEntryOf`: the one on screen, its changeset's, or the review's whole
  diff when opened away from the code, each the query the Changes tab reads); and **How it was applied** (Since then,
  for a thread not applied), the version commented on, the thread on the left, against what the changeset that applied it
  did to the file (that changeset's diff, one immutable read, `appliedComparison`: its own diff when the comment is on
  the version it made; "Changeset N didn't change this file" for a request marked applied by hand), or the review's
  newest version (its whole diff's, never a
  changeset's). Every **Applied in N** pill (the
  code, the Comments panel, the conversation) opens it on How it was applied; its **Open changeset N** opens the
  changeset itself. The dialog shows the thread as the conversation has it now (`liveThreadOf`: a reply made in it
  shows, a thread deleted is gone), takes the step keys while the diff behind it waits (`keysReach`, the dialog marked `STEP_FRAME`, docs/ARCHITECTURE.md
  "Keyboard"), and closes if the
  window goes to another place. A dialog rather than a mode of the file's diff, so the review's diff stays as it was:
  "Changes since this comment" did that in the diff itself (its older side swapped, a "Since comment" chip to go back,
  "Since review" off meanwhile), and the state it left was hard to read.
- **Mode.** A comment belongs to the diff it was written in (`ReviewComment.changesetId`, `writtenIn`): a branch
  review's "Whole branch" or one changeset of "Changeset by changeset" (`reviewDiffViewOf`). Going to one opens that
  mode and changeset (`threadDiffRequest`, `DiffFocusRequest`; from a page, `focusChangeset`). A changeset's diff shows
  only the threads written in it; the whole branch's also shows those written changeset by changeset that are on a
  revision it shows, or whose line is still there in the newest one (an outdated one is left to its changeset's diff),
  so an open change request never hides behind the mode it was written in. A review of a
  changeset or a shelve has one mode. Files under an xlink are another repository's, and have none.
- **Hidden.** The file header's comment button (`useReviewCommentsStore.inCode`, one setting for every review) hides
  the threads from the code (its tooltip says which way it goes: Hide or Show comments in the code): each line holding
  some keeps a marker at its end (`LineMarkers`, `shownThreadRows`), showing who wrote there and how many comments
  there are, as a pull request's do (`markerPeople`, `markerCommentCount`), in the Open color while anything there is
  open (`markerIsOpen`); a click opens that line's threads, an × folds them back. The outdated ones hide too: they have no line to mark, so they show only when one of them is gone to (from
  the panel or the conversation), with an × that hides them again (`annotationRowsOf`'s `opened`, `OUTDATED_ROW`).
- **The Comments panel**, beside the diff (`ReviewCommentsPanel`, hidden and shown by the diff header's button like
  any details panel, `DetailsToggleButton`, and closed by its own ×), lists every thread on the code as the conversation sums up a settled one
  (`ThreadSummaryCard`), by file and line (`commentsPanelThreads`), **Open** or **All** (opening on Open when anything
  is, `initialCommentsFilter`). A click goes to the thread: its file, its mode, scrolled to it and lit
  (`ReviewComments.goToThread`, `ThreadFocus`). Under its header, where the one gone to is ("3 of 12",
  `commentPosition`) and arrows to the previous and next; **N** and **⇧N** do the same with the panel hidden
  (`steppedThread`: in the panel's order, across files and modes, stopping at either end; from a thread that just
  left the list, settled under Open, on from where it sat). The panel's filter is kept by the Changes tab for that
  (`ReviewChangesTab`), and stays on what it opened on as threads settle (`shownCommentsFilter`). In the code, the thread gone to keeps its ring until another one is:
  among the outdated ones, stacked alike, the eye finds it again. A diff opened to go to a thread (from the
  conversation, `commentLocationPage`) opens at it, not at its first change, even before an earlier version is read
  to place it (`holdsThread`, `DiffAnnotations.opensAtRow`); a version that can't be read (purged) keeps the diff
  at its top.
- In the code, a thread is the conversation's card (`ReviewThreadCard` with `inCode`): its kind instead of its file,
  replies, edits, deletes and discards as in the conversation, and its first comment's menu leads to **Show in
  conversation** (the Conversation tab scrolled to it and lit, `conversationAt`, a page of its own: Back returns to
  the code at the thread).
- A line a thread is on is never hidden in a folded unchanged region: the diff unfolds it (`DiffAnnotations`,
  docs/features/diff.md "Rows under lines").
