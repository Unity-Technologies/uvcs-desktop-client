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
  server notes the rename), at its end the reviewed code to the workspace (a shelve's "Apply to workspace", the one
  Apply its page offers: the shelve's diff below drops its own, `pageApplies`), **Your review**, Refresh and the page's menu
  (`reviewPageMenu`: a new window, Copy, Delete; what the page shows already has its own control, and deleting stays out
  of the way); then the status, who wants a review of what and when. The reviewers are beside the conversation, not in
  the header. Then two tabs (`ui/Tabs`): **Conversation**, with the number of comments, and **Changes**, the reviewed
  diff. The page names the tab it shows (`PageOf<'codeReview'>.tab`, `openingTab`): the conversation, unless it names a
  file (`focusPath`, a link's `/-/files/<path>`), which the changes show. Picking a tab shows the page with it in place
  (`navigation.replacePage`), so Back leaves the review, and the page's link follows it: the review alone on its
  conversation, the review and its file on its changes (`pageLinkTarget`). Each tab shown so far stays mounted, the
  other hidden (`mountedTabs`), so going back to one finds it as it was left: its scroll, the threads unfolded, a reply
  being written, the file selected, the Comments panel's filter. The Changes tab isn't mounted, so not read, until it's
  first shown, and while hidden its keys are off (N, ⇧N, ⌥⇧↓ ⌥⇧↑: `ViewShownContext`, which `useShortcut` reads).
- **Refresh** (the header's button, ⌘R, the menu's; in a page window too): others write on a review while it's open,
  someone waiting for comments (a teammate, an agent) among them, and a focus reads it again only once stale, so the
  page reads it again on demand, in place. With the review in front, Refresh reads only what the page shows
  (`pageRefreshScope`, `isShownByCodeReviewPage`): the review (status, title, description), its conversation and its
  reviewers; for a branch's review also the branch's files and changesets, where a change request gets applied. Not the
  lists of reviews, the view under the page, the top bar or the sidebar: three `cm` reads, and on a branch review's
  Changes one more for what they show (`cm diff` of the branch, or its changesets changeset by changeset). The review
  read goes into the lists already read that hold it (`showReviewReadInListsIn`, `withReviewRead`: each list keeps
  when it was read, and one an operation marked stale is left to its own read), so Back finds the Code reviews view
  with the review's new status and counts, at no `cm` command of its own.
  Nothing remounts, so the tab, the file selected, the scroll and the threads unfolded stay; the icon spins while any
  of it is read. Nothing reads it on a timer.

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
  reviewers (see "Reviewers and their status") and **Open**: the change requests and questions still open
  (`ReviewSideRail`, `openItemsOf`).
- **Going to a thread** (`threadPick`): a click on an Open entry, or the page opened at a thread ("Show in
  conversation", from the code), makes that thread the current one (`pickThread`, `pickOnFocus`). Its card is brought
  into view (`pickedScrollOf`): from Open, only as far as it must, a card on screen staying where it is and one off
  screen gliding to the nearest edge; when the page opens at it, centered at once. It's unfolded, lit for a moment
  and ringed in the accent until another is gone to, as a thread selected in the code is (`threadMarkOf`: the card's
  `highlight` and `selected`); its Open entry keeps the Comments panel's accent bar. Each pick counts, so going to the
  thread already on screen, or to the same one again, lights it again: without it, a click on what's already in view
  seemed to do nothing. A pick in Open makes the page forget the thread it was opened at (`pageAfterOpenPick`), so Show
  in conversation at that thread again goes to it. A tab picked keeps the current thread. At the end of the entry of a
  comment on a file's line, under the pointer or once a key reaches it, a button shows the thread in Changes ("Show in
  Changes", its file in the tooltip), going where its card's file link goes (`commentLocationPage`). It sits in Open
  only: on the cards it was rejected (see below).
- A thread (`threadsOf`, `ReviewThreadCard`) is a comment and its replies. A reply whose comment another client deleted
  starts a thread of its own. One on a line shows its file first, the whole path a link to it in the Changes tab, on the
  same page as a tab moves (a place in the review on top replaces it, never stacks a second page of it:
  `movesWithinTop`), opened at the thread, in the mode it was written in (`commentLocationPage`: `focusThread`, and
  `focusChangeset` for one written changeset by changeset; see "Comments in the code"), then, apart and as text, the
  line it was written on ("line 1962", `writtenLineText`). Not "file:line" as the link: it read as going to that line,
  which an outdated comment's no longer is, and only the name looked clickable. Not a "Show in code" button: on every
  card, even shown only under the pointer, it was noise. Not the whole card: in the conversation a card is read, replied
  to, folded and selected. Its header is one quiet line: its kind's icon, its folder (giving way first in a narrow
  card), file and line (`locationText`), and where it stands in words (`threadBadges`), as the server counts open ones:
  a change request is **Open** until a changeset applies it (**Applied**, the pill a link to how it was applied, its
  tooltip naming the changeset: "Applied in changeset 4: see how it was applied", `appliedPillTip`; shown in how it was
  applied itself, it only names the changeset, as opening it would go behind the dialog, whose footer opens it:
  `threadHeaderOf`'s `inContext`) or a reply discards it (**Discarded**); a question is **Open** until anyone replies
  (**Answered**: any reply answers it, there's no other way to resolve one). Other comments are never open. A settled
  thread starts folded to that line and its first words (`startsFolded`, `repliesText`), so what's open stands out; a
  click shows it whole (by keyboard, its fold toggle: the folded line is the pointer's way only, so it isn't a second
  tab stop). **Answered** is a link as **Applied** is, in the conversation and in the code (not the Comments panel's
  cards, which go to the thread): it shows the thread whole, scrolled to the reply that answered it, the first, lit for
  a moment ("Answered by Borja: see the answer", `answerOf`). Where it stands is an outlined pill: **Open** in the color
  of "Rework required", **Applied** and **Answered** in the color of "Reviewed", **Discarded** neutral.
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

- **Files with comments**: in the list of files, a comment icon by the status letter of each file holding threads in
  the diff shown, how many in its tooltip, and a **Commented** chip after the status chips showing only them
  (`reviewFileFlag`, `fileThreadCount`, through `EntryFlagContext`). It counts every thread, whatever the Comments
  panel's Open/All shows, so the icon and the chip agree, and from the threads alone, as the list reads no file
  (gathered by file once per diff: a list of thousands of files reads each thread a few times). See in
  context's list marks the commented file the same way, with no chip (`commentedFileFlag`).
- **Where a thread goes** (`threadsOfFile`, `fileCommentsOf`). A comment is on a line of one revision of a file
  (`{revisionid}`, `{line}`), found in the diff by its path or the path the file moved from. On the revision the
  diff's newer side shows, it sits under its line; on the one its older side shows (a file the review deletes, which
  `cm` comments on its last revision), under that line on the left. On an earlier version of the file (the reviewer
  commented at cs:8, the author checked in cs:9 and cs:10), that version and the newer side are read
  (`versionsToRead`, `useFileVersionTexts`: one immutable read each, only for a file shown that has such threads; the
  file's threads on earlier versions wait until every one is read or has failed, so a row placed never moves for
  another arriving, Pierre keeping rows by their place, `placeEarlier`; one whose read failed holds none of the
  others, and its threads are outdated, their line known though not their text; a purged one reads as empty), and
  the line is followed into the newest version (`newerLineOf`, a line diff ignoring line ends): unchanged, the thread
  sits at its line there, tagged **Earlier version**; changed or gone, it is **outdated**, gathered above the code
  ("2 outdated comments", folded), each with the lines it was written on (`snippetOf`) (`earlierTagOf`). Why not the
  official client's banner (Revision with comments, Last in branch, Diff with head): most comments still sit on code
  that didn't change, and those read best in place; the rest are what GitHub calls outdated, and its way of showing
  them is known.
- **See in context**: the tag of a thread on an earlier version (**Outdated**, or **Earlier version**) is a button that
  opens a dialog (`openCommentContextDialog`, opened through `useCommentContext`) with two views, each the file's diff
  with the thread at its line (`commentContext`): **When commented**, the diff it was written on, as its author saw it
  (the older side of the diff it was written in, `contextEntryOf`: the one on screen, its changeset's, or the review's
  whole diff when opened away from the code, each the query the Changes tab reads); and **How it was applied** (Since
  then, for a thread not applied), the version commented on, the thread on the left, against what the changeset that
  applied it did to the file (that changeset's diff, one immutable read, `appliedComparison`: its own diff when the
  comment is on the version it made; for a request applied in a changeset that didn't change its file, that changeset's
  files, below; for one marked applied in a changeset with no file to compare, the thread alone under one line saying
  so, the subtitle saying it was marked applied there, not applied: `notInChangeset`), or
  the review's newest version (its whole diff's, never a changeset's). A view waits for the diff it reads, says so when
  that read fails, and why it has nothing to compare otherwise (`contextComparisonState`). Every **Applied** pill (the
  code, the Comments panel, the conversation) opens it on How it was applied; the tag opens it on When commented. No
  separate "See in context" button: beside the tag and the pill, a third control opening the same dialog read as
  something else. Its **Open changeset N** opens the changeset itself. When that changeset changed other files too, the
  dialog lists them all, as a changeset's diff does (`AppliedChangesetFiles`: `DiffBrowser` with its filter, change
  types and tree, the commented file selected first; `appliedFilesOf`, `listsAppliedFiles`), so the reviewer sees what
  else the fix did and which file the comment is on. The commented file's diff is the comment's (an
  `EntryAnnotatorContext` comparing its own versions, `AnnotatedEntry.compared`); the header's view switch shows only
  while it's selected (`appliedFilesHeading`). When that changeset didn't change the commented file at all (the request
  applied elsewhere: a missing test added, a sibling fixed), How it was applied lists its files alone, the first
  selected, the thread above them, folded to its first words (`contextBodyOf`, which picks it over the thread alone;
  unfolded, it takes at most 40% of the height, its border whole and its comments scrolling inside it under its header
  band, `data-thread-body`: the box scrolling the card cut its border off, and the card shrunk alone clipped a long
  thread with nothing to scroll), so the request and its fix read together; the subtitle
  says the changeset applied it in other files, and the view switch stays, leading back to When commented. It says
  "applied", even for a request marked applied by hand there: what the review records can't tell the two apart, and
  the files beside it show what that changeset did. No list for a fix of that file alone. The list costs no command:
  it is the changeset's diff "How it was applied" reads anyway. Why not open the changeset's diff page: the reviewer
  would leave the review, and that page knows nothing of the comment. The dialog is as wide as the window allows, up to
  1680 px: two versions of code side by side, and the files beside them. Its diff
  is 66vh tall, less where the window leaves the dialog less, so the dialog never scrolls as a whole (a window of
  1000×800 or 900×700). Its diff's comments button hides the thread from the code, to read the code alone, as the
  review's diff does: a marker on its line, a click showing it again (`useThreadRow`, `contextThreadParts`,
  `CommentsInCodeButton`); its line keeps its outline in the accent, the thread being what the dialog is about. It
  shows each time the dialog opens: the review's own setting doesn't hide it there, nor does hiding it there change it.
  It shows the thread as the conversation has it now (`liveThreadOf`: a reply made in it shows, a
  thread deleted is gone; the page's own read, never read again as it opens: `SHOWN_BY_THE_PAGE`), takes the step keys
  while the diff behind it waits (`keysReach`, the dialog marked `STEP_FRAME`, docs/ARCHITECTURE.md "Keyboard"), and
  closes if the window goes to another place, view or page: what its files' menus and lines open (History, Annotate)
  then shows, not behind it (`navigatedSince`). A dialog rather than a mode of the file's diff, so the review's diff
  stays as it was: "Changes since this comment" did that in the diff itself (its older side swapped, a "Since comment"
  chip to go back, "Since review" off meanwhile), and the state it left was hard to read.
- **Mode.** A comment belongs to the diff it was written in (`ReviewComment.changesetId`, `writtenIn`): a branch
  review's "Whole branch" or one changeset of "Changeset by changeset" (`reviewDiffViewOf`). Going to one opens that
  mode and changeset (`threadDiffRequest`, `DiffFocusRequest`; from a page, `focusChangeset`). A changeset's diff shows
  only the threads written in it; the whole branch's also shows those written changeset by changeset that are on a
  revision it shows, or whose line is still there in the newest one (an outdated one is left to its changeset's diff),
  so an open change request never hides behind the mode it was written in. A review of a
  changeset or a shelve has one mode. Files under an xlink are another repository's, and have none.
- **Hidden.** The file header's comment button (`useReviewCommentsStore.inCode`, one setting for every review) hides the
  threads from the code (its tooltip says which way it goes: Hide or Show comments in the code): each line holding some
  keeps a marker at its end (`LineMarkers`, `shownThreadRows`), showing who wrote there and how many comments there are,
  as a pull request's do (`markerPeople`, `markerCommentCount`), in the Open color while anything there is open
  (`markerIsOpen`). Its tooltip previews each thread there as plain text, its first words (cut at a word about 80
  characters in) over its kind, where it stands, who started it and its replies ("Question · Open · Borja · 1 reply"),
  three at most and then how many more (`markerTip`); not the line, which it's on, nor who wrote there, which its
  avatars show; a screen reader still hears the kind, the line and the people (`markerLabel`). A click opens that line's
  threads, and going to a thread opens its line. The outdated ones hide too, and keep a marker of their own on the
  code's first row (`outdatedMarkerOf`, `lineNumber: 0`; none while that row isn't rendered, `topRowOf`), so hiding
  comments never leaves a file looking as if no one commented on it: a clock, then who wrote and how many comments, as
  a line's marker beside it counts them; its tooltip says they're outdated, then previews them as a line's does. A click shows every one it marks; one gone to
  (from the panel or the conversation) shows alone, as a line opens alone (`outdatedKey`, `openedOutdated`; the opened
  ones share one row above the code, `annotationRowsOf`'s `opened`), and the marker counts the rest. Line 1's marker,
  on the same row, sits beside it (`markerSpots`). Each card opened so
  has an × at the end of its header (`ThreadInCode.hide`, `hideLabel`: "Hide this comment") that folds it back to its
  marker: in the header, not in a column beside the cards, which took their width; an ×, not an icon of a comment struck
  through, which read less plainly. In a narrow card the header stays one line: the kind's name is cut short first, then
  the tag, the state and the × keeping their place.
- **In the scrollbar.** The diff's change map (docs/features/diff.md "The change map") ticks every line with threads,
  and the outdated ones at its top (`commentMapTicks`, through `DiffAnnotations.mapTicks`), whether comments show in
  the code or are hidden behind markers: a thin line across the track, in the Open color while anything there is open
  (`markerIsOpen`), a quiet gray once everything is settled. Its tooltip previews the threads there as their marker's
  does (`commentMapTip`, built on `markerTip` and `outdatedTip`): the lines' threads of ticks fused together in one,
  three at most and then how many more, then the outdated ones under their "Outdated" heading when their tick at the top
  fused with a comment on the first lines, so they never read as on that line. A file the review adds or deletes gets the map for its comments alone, with no change
  blocks. A click scrolls there as anywhere on the track, not to the thread: N and ⇧N, and the panel, go to threads.
  Threads still being placed (their version being read) have no tick until they are.
- **The Comments panel**, beside the diff (`ReviewCommentsPanel`, hidden and shown by the diff header's button like any
  details panel, `DetailsToggleButton`, and closed by its own ×; on a review with no comments on its code it starts
  hidden, and so it does where the code beside it would be narrower than `MIN_READABLE_DIFF_WIDTH` (480 px; the tab's
  width less the files' and the panel's, `diffWidthBesidePanel`, each side's half of it side by side), decided as the
  changes first show, so a first comment doesn't open it, and the user's own choice is kept for the next review:
  `commentsPanelStartsHidden`, the details store's `startedHidden`, never saved), lists every thread on the code,
  **Open** or **All**, in the order a small sort button by its arrows chooses (`CommentsOrderMenu`, `CommentsOrder`,
  kept for every review in `useReviewCommentsStore.panelOrder`; `commentsPanelThreads`):
  - **Code order**, the default: by file, as the diff lists them, then line, grouped under each file's name
    (`commentsByFile`), so a file with many comments is named once. The name stays at the top while its comments scroll
    (sticky), with its folder cut from the start (the folder nearest the file stays) and how many. A click on it folds
    its comments away and back (`toggledFold`); the sort menu folds or unfolds every file at once, one entry saying
    Collapse all while any is open, else Expand all (`foldAllEntry`; collapsing keeps the folds of files the filter
    hides now). While searching, every file shows unfolded, so a match says why it's listed (`shownFolds`). Going to a
    comment (a click, the arrows, N) unfolds its file (`unfoldedFor`), so the one gone to never hides; the folds are
    kept by the Changes tab, as the filter is. The name doesn't also show the file: two targets in one band read worse,
    and a row goes there. Each thread is a row (`ThreadSummaryRow`, header place `fileGroup`): its kind's icon leading,
    as a bullet; who started it, "line N" and its replies, then its state; its first words under them, as wide as the
    row. A line number in a column of its own read as an id, and the icon beside the words took their room. In a narrow
    panel, who started it is cut first, then the replies, the line last. The one gone to has the accent bar on its left.
  - **Newest first** and **Oldest first**: by the latest comment or reply in each thread, so a reply brings an old
    thread up; one list, as the conversation sums up a settled thread (`ThreadSummaryCard`; its file and line only name
    where it goes, cut short in turn, the folder first, then the line, the file's name last, and whole in a tooltip).
    Grouping by file would cut the time order apart, so a time order never groups, and grouping is not a choice of its
    own.

  It opens on Open when anything is open (`initialCommentsFilter`). A row under the header narrows it further: words
  found in what was said, replies too, who said it and the file (`matchesCommentsSearch`; a plain search field, as the
  view's ⌘F belongs to the files' filter), and a chip per kind, its icon and how many Open or All lists
  (`threadKindCounts`); a search finding nothing offers "Clear filters". While searching, a card shows the comment the
  words were found in, a reply too, from a little before the match (`matchExcerpt`, found as the marks are:
  `lowerCasedText`), in place of its first words, and the words are marked there, in who said it and in the file
  (`HighlightQuery`), so each card says why it's listed. The keys step through what it lists, in the order shown. A
  click anywhere on a card goes to the thread (not the end of a drag selecting its text): its file, its mode, scrolled
  to it, whole, and lit (`ReviewComments.goToThread`, `ThreadFocus`). Under the filter row, where the one gone to is ("3
  of 12", and "· 4 files" when grouped, `commentPosition`) and arrows to the previous and next (its own row: in one with
  the name and Open/All, the header read worse); **N** and **⇧N** do the same with the panel hidden (`steppedThread`: in
  the panel's order, across files and modes, stopping at either end; from a thread that just left the list, settled
  under Open, on from where it sat). The card gone to comes into the panel's view, a third of the way down, the list
  still when it shows whole (`listScrollTop`, gliding unless motion is reduced, N pressed again aiming from where the
  last glide goes), and the focus a card held goes along to the current one, drawn without a ring: left behind, the key
  would draw it on a comment no longer current. The panel's filter is kept by the Changes tab for that
  (`ReviewChangesTab`), and stays on what it opened on as threads settle (`shownCommentsFilter`). In the code, the
  thread selected keeps its ring until another one is: among the outdated ones, stacked alike, the eye finds it again. A
  diff opened to go to a thread (from the conversation, `commentLocationPage`) opens at it, not at its first change,
  even before an earlier version is read to place it (`holdsThread`, `DiffAnnotations.opensAtRow`); one on a version
  that can't be read (purged, or its read failed) is among the outdated ones, above the code, and opens there.
- **What a comment is about.** In the code, each line with threads is outlined across its pane, open or hidden behind
  its marker (`lineBandsOf`, through `DiffAnnotations.bands`), in its card's border color (`--border-comment`, a step
  stronger in the dark theme, where the default border disappears over the added and removed tints): a border, never
  a fill, so the diff's tints keep meaning added and removed only. The line's corners are slightly rounded
  (`--radius-sm`), softer than a selection, a line's and not a card's: the card's radius on one line reads as a pill.
  A row under an added or removed line takes its tint (docs/features/diff.md "Rows under lines"). The outline was
  tried joined to the card as one shape (the line its first row, or its sides running into the card): the card keeps a
  reading width, so where the line is wider the shape read as broken, and a card stretched to the line read worse.
- **The thread selected** has its card and its line outlined in the accent, and its entry in the Comments panel marked.
  Gone to (from the panel, the arrows, N, the conversation), it's scrolled to, unfolded and lit. Picked in the code, it's
  only selected (`ReviewComments.selectThread`, `ThreadFocus.inPlace`, `selectedInPlace`): a click anywhere in its card
  or the focus entering it (Reply, Tab), its controls still doing what they do, or opening its line from the marker
  (the line's first thread, `threadOpenedFrom`). It's on screen already, so the diff stays where it is
  (`scrollsToFocus`), the card is ringed but neither unfolded nor lit (`cardFocusOf`: unfolding it would undo the
  chevron's click that folds it, which selects it too), and the panel brings its entry into view only when it's out of
  it (`listScrollTop`). Picking the thread already selected changes nothing, so the focus moving within a card moves no
  list. Under a filter that hides it, the panel marks nothing, and keeps its filter.
- In the code, a thread is the conversation's card (`ReviewThreadCard` with `inCode`): its kind instead of its file,
  replies, edits, deletes and discards as in the conversation, and its first comment's menu leads to **Show in
  conversation** (the Conversation tab scrolled to it and lit, `showInConversation`: the page moves to it in place,
  as its tabs do; never stacked, both tabs staying mounted as they were left, so Back leaves the review).
- A line a thread is on is never hidden in a folded unchanged region: the diff unfolds it (`DiffAnnotations`,
  docs/features/diff.md "Rows under lines").
