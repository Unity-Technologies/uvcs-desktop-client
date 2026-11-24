# Code reviews

A code review asks people to review a branch, a changeset or a shelve. A merge request is the same object on the
server, with a destination branch and a state: what this doc says of reviews holds for both, and what is a merge
request's alone (its states, the Merge requests view's State chip, its chips) is in docs/features/merge-requests.md.

Every review command relies on the `cm` the app runs, which is never older than its own (cm-runtime.md "Which cm
runs"): with `--format`, a field an older `cm` didn't know would fail the whole command, and a subcommand it didn't
know (`cm codereview subscription`) would be read as a review to create.

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
  they gave already. The button reads their status, or Review when they aren't a reviewer (`ownReviewButton`). The
  popover's draft is whole: the status picked (`useOwnReviewChoiceStore`, `ownReviewChoice`) is kept with the comment
  (`useCommentDraftStore`), under one key per review, as the popover closes (a click elsewhere, to copy something into
  the comment), and both are cleared once sent; it opens on the status the user gave until they pick another. A pick
  remembers the status it was picked over (`OwnReviewPick`'s `over`): once the user's status changes elsewhere (the
  menu, another window), the pick is dropped and the popover opens on the status they now have. Only
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
  groups too. Elsewhere (the list's stack, the picker's offered groups) the server's groups
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
  **New code review** picks its reviewers with the same picker, never typed names (`ReviewersField`: the reviewers picked as chips in a box, each with
  its × and a user's email under the pointer; the heading's button, or a click on the box, opens the picker from the heading's end, so it stays put as chips
  are added, those picked as it opened leading its list as on the review page, `pickAsPickerOpens`; **Remove all**
  once there are several, `pickedReviewersOf`; a chip removed leaves the keyboard on the next one or on the heading's
  button, `focusAfterRemoving`), each asked as the
  kind it was listed with, so a group found by a search stays a group (`reviewersToAsk`), in the command that creates
  it (`cm codereview <target> <title> --users=a,b --groups=g`, `createReviewArgs`). A merge request's dialog has the
  same field (docs/features/merge-requests.md "Creating one"). Reviewers come from the server's lists or its search, so an unknown
  name is never asked; if `cm` refuses one anyway, its message shows in the failure toast.
- Finishing a task can mark the user's review as reviewed once merged (docs/features/merge.md, `canMarkReviewed`).
- `cm codereview -e --status` isn't used: it sets the status of the review's first reviewer, and fails on a review
  with more than one.

## The list

The list is the **Merge requests** view, merge requests and code reviews together (merge-requests.md "One view").

- One `cm find review` reads each review with its reviewers and the status each gave (`{reviewers}`,
  `name:Status` pairs, `parseReviewers`; which are groups, the server's groups say: see "Groups"), the number of comments (`{comments}`: comments, questions, change requests
  and their replies) and of open ones (`{unresolvedissues}`: change requests neither applied nor discarded, questions
  with no reply), and the last activity (`{modifieddate}`). `{codereviewstatusname}` prints the status in English
  whatever the client's language; `{status}` translates it (`FOUND_REVIEWS`).
- Columns: the title, where it stands as an icon (merge-requests.md "One view"), the reviewers (`ReviewerStack`, from `stackedReviewers`: their avatars stacked in
  `ui/AvatarStack`, three then a "+N" disc whose tooltip names the rest; hovered, the stack spreads and each avatar
  shows its reviewer's status as a badge in its corner, the status's icon in its color (`reviewerBadge`,
  `REVIEW_STATUS_ICONS`: an eye, a flag, a thumbs-up), fading in as the avatar settles, and its tooltip names them with
  it, `reviewerText`; at rest the stack shows only who, the icon beside the title saying where the review stands (the keyboard
  never spreads it: a sighted keyboard user reads each reviewer's status on the review's page, beside its conversation,
  where every reviewer shows their status's icon); the details panel lists them under **Reviewers**, each with their
  status's icon (`ReviewerList`, read only), and a review of a branch the branch's attributes under **Branch
  attributes** (`reviewDetailsSections`, `AttributesDetailsSection`; hidden with nothing to show or add, `attributesSectionOf`); the column is `REVIEWERS_COLUMN_WIDTH`, wide enough for the stack spread), the
  comments with how many are open (`ReviewCommentCounts`; sorted by what's open first, `commentCountsSortValue`), the
  changes, the author and the last activity. When it was created has no column, to keep the rows light: the list
  comes newest first as `cm` reads it, its period goes by it, and the details panel says it. Each row leads with what
  it is, a merge request's state glyph or the code review glyph, never its number (merge-requests.md "Its number").
- **A review waiting for the user** has a small accent dot before its glyph (`codeReviewColumns`, which takes the
  user, `usePlaceUser`, and is built again only when the user changes, so the table keeps its columns while it sorts).
  It waits (`waitingForMe`) when the user is a reviewer, by name (`sameUser`), whose own status is Under review
  (tooltip "Waiting for your review"), or wrote it and it's in Rework required with something open,
  `{unresolvedissues}` above zero (tooltip "Rework: 3 open"). It's decided from the list's own fields: a group the
  user belongs to isn't told (its members would take a command per row), nor is a reviewer asked again told from one
  who never looked (both are Under review). No column says why: the tooltip does.
- **Reviewers** are picked as the authors are (`PeopleFilter`, the store's `reviewers`, a `PeoplePick`): **I'm a
  reviewer**, one click, and beside it a picker of the reviewers the list showed (`usePeopleSeen`). I'm a reviewer alone
  is the server's, `where reviewer = 'me'`, which `cm find`'s help doesn't list but the official client uses
  (`codeReviewsQuery`); with others picked the query asks for every review, the same query key as no reviewer filter,
  and keeps the rows locally (`matchesReviewers`): `cm find review` takes no reviewer but the user. The "I'm a reviewer"
  chip an older version remembered (`reviewerIsMe`) reads as I'm a reviewer (`restoredReviewersFilter`, a
  `FilterUpgrade`).
- **Waiting for me** (a `ToggleChip`, the store's `waitingForMe`) keeps the rows with the dot, counting them,
  "Waiting for me · 2" (`waitingChipLabel`, `waitingCount`). It narrows the reviews read, in the time range, locally
  (`matchesWaiting`), asking the server nothing of its own (`codeReviewsQuery`): its count is what pressing it shows,
  and pressing it runs no command. Reading every date while it was on, as the official client's "Needs my review" does,
  was tried: the count, made from the time range, then changed once pressed. It takes the user's
  own reviews in rework, which `reviewer = 'me'` leaves out, and goes by each reviewer's own status, which the query
  can't ask for. A chip of its own, not a third choice of a reviewer menu ("Any reviewer, I'm a reviewer, Waiting for
  me", tried): it mixes the user's reviews and their rework, so it read as a filter of its own folded inside another.
  The sidebar counts the same reviews on **Merge requests** (`useWaitingForMeBadge`, `waitingBadge`), from the list the
  view reads (`useCodeReviewsListFilter`: one query key, one `cm find review` in the time range), so the count shows as
  the window opens. It reads that list once the first screen is in (the pending changes read, or failed; at once on a
  repository, which reads none: `badgeReadsReviews`), so it never competes with the window's first reads, and rarely
  (`SLOW_CHANGING_QUERY`): a focus reads it again only while the view shows it; a write on a review and the Refresh
  button do. Opening the view within its own staleness (thirty seconds) shows that list without reading it again. The
  read is bounded by the view's time range (the last three months unless the user chose another), so a user who chose
  Any time reads every review as each window opens: the count must agree with the view's Waiting for me. Counting only
  once the view was opened, as a sidebar read nothing, was tried: the count was missing until then, where the user
  looks first. It counts Waiting for me only, never with Opened by me: it says the user has
  something to do.
- **Opened by me** (a `ToggleChip`, the store's `openedByMe`) keeps the user's reviews not reviewed yet (Under review or
  Rework required), counting them, "Opened by me · 2" (`matchesOpenedByMe`, `openedByMeCount`,
  `openedChipLabel`), as the official client's preset of that name does in one click. Like Waiting for me, it narrows
  the reviews read, in the time range, locally, asking the server nothing of its own. Waiting for
  me and Opened by me are chips, not presets that set the other filters: each is one condition that combines with the
  rest. Presets in the sidebar, as the official client lists them, were left out: two more rows for what a count and two
  chips say.
- The list reads every review its filters keep (the time range, Last 3 months by default, who created them, the
  status, I'm a reviewer alone, and a merge request's state when it is Merged or Closed: merge-requests.md "One
  view"), with no cap (`CodeReviewFilter.limit` unset), as the other lists do: its text filter, which
  looks through each row's number, title, target and people (`reviewFilterTexts`), then finds any review in the range,
  and "No matching merge requests" hints a longer one. A large repository (about 6,600 reviews) reads all of them, Any
  time, in one `cm find` of about 1.5 MB, under a second; their branches are named from the names of every branch, read at
  most once (`BranchNamesCache`). The palette reads only the newest `NEWEST_CODE_REVIEWS` (`reviewSummariesQuery`);
  the branch chips read the reviews of the branches shown, in blocks (merge-requests.md "Reading the branches'
  reviews"). The palette finds an older review by its title (`cm find review … like`) or its number,
  typed alone or after `cr:` (one `cm find review "where id = N"` once typing pauses; ARCHITECTURE.md "Prefixes").

## The review's page

- The header, two rows: the title (the pencil edits it in place, `ReviewTitle`; `cm codereview -e --title`, and the
  server notes the rename), at its end the reviewed code to the workspace (a shelve's "Apply to workspace", the one
  Apply its page offers: the shelve's diff below drops its own, `pageApplies`), **Your review**, Refresh and the page's menu
  (`reviewPageMenu`: a new window, Copy, Delete, and a merge request's moves; what the page shows already has its own
  control, and deleting stays out of the way); then the status, who wants a review of what and when (a merge request's
  headline: docs/features/merge-requests.md "The page"). The reviewers are beside the conversation, not in
  the header. In a narrow window the title keeps a readable width (280 px) and the actions wrap to a row of their own
  under it, the switch's words cut first; what's reviewed, the dot and when wrap together (`CodeReviewPage.module.css`).
  Then two tabs (`ui/Tabs`): **Conversation**, with the number of comments, and **Changes**, the reviewed diff. The page names the tab it shows (`PageOf<'codeReview'>.tab`, `openingTab`): the conversation, unless it names a
  file (`focusPath`, a link's `/-/files/<path>`), which the changes show. Picking a tab shows the page with it in place
  (`navigation.replacePage`), so Back leaves the review, and the page's link follows it: the review alone on its
  conversation, the review and its file on its changes (`pageLinkTarget`). Each tab shown so far stays mounted, the
  other hidden (`mountedTabs`), so going back to one finds it as it was left: its scroll, the threads unfolded, a reply
  being written, the file selected, the Comments panel's filter. The Changes tab isn't mounted, so not read, until it's
  first shown, and while hidden its keys are off (N, ⇧N, ⌥⇧↓ ⌥⇧↑: `ViewShownContext`, which `useShortcut` reads).
- **Refresh** (the header's button, ⌘R, the menu's; in a page window too): others write on a review while it's open,
  someone waiting for comments (a teammate, an agent) among them, and a focus reads it again only once stale, so the
  page reads it again on demand, in place. With the review in front, Refresh reads only what the page shows
  (`pageRefreshScope`, `isShownByCodeReviewPage`): the review (status, title, description), its conversation, its
  reviewers and the user's email subscription; for a branch's review also the branch's files and changesets, where a change request gets applied. Not the
  lists of reviews, the view under the page, the top bar or the sidebar: three `cm` reads, a fourth for the user's
  email subscription (from a `cm` that has it), a fifth on a branch's review for its changesets, which its rounds, its
  chips and Changes share (`useReviewChangesets`, one `cm find changeset`), and on Changes one more for what they show (`cm diff` of the branch, of a changeset or of several). The review
  read goes into the lists already read that hold it (`showReviewReadInListsIn`, `withReviewRead`: each list keeps
  when it was read, and one an operation marked stale is left to its own read), so Back finds the Merge requests view
  with the review's new status and counts, at no `cm` command of its own.
  Nothing remounts, so the tab, the file selected, the scroll and the threads unfolded stay; the icon spins while any
  of it is read. Nothing reads it on a timer.

## Email notifications

- The server emails a review's people as it changes, when its repository has the "Code Review Email Trigger". The
  page's rail ends with **Notifications** (`NotificationsSection`): one sentence of why the user gets the review's
  emails, and one button, **Unsubscribe** or **Subscribe** (`subscriptionSection`). Why, as `cm` names it
  (`ReviewSubscription.reason`): "You get emails because you opened this review" (`owner`), "…you're a reviewer",
  "…you commented", "…you were mentioned", "…you subscribed" (`manual`), and "You get emails about this review" for a
  reason this version doesn't know. Unsubscribed: "You don't get emails about this review". With no subscription of
  their own (`none`): "You aren't subscribed to this review", not "no emails", as a reviewer group they belong to may
  still send them. Unsubscribe's tooltip says the emails stop until they take part again: the server subscribes them
  again when they comment, someone mentions them, or adds them (or a group they're in) as a reviewer.
- It reads one `cm codereview subscription <id> --format={subscribed} {reason} {emails}` as the page opens
  (`CodeReviewsApi.subscription`, `useReviewSubscription`, `query()`; three fixed English words, `parseReviewSubscription`).
  It hardly changes by itself, so a focus doesn't read it again (`SLOW_CHANGING_QUERY`). Only the writes that make the
  user take part read it again (`isAffectedByTakingPartInReview`): a comment, on the review or a line, a reply (a
  discard is one), reviewers added, the user's own status; the server subscribes them again then. A rename, an edit, a
  delete, a reviewer removed or asked again don't (`isAffectedByCodeReviews` leaves it out). The page's Refresh reads
  it (`isShownByCodeReviewPage`).
- Subscribe and Unsubscribe are one quick `cm codereview subscribe <id>` or `unsubscribe <id>` (`setReviewSubscription`),
  for the signed-in user only; they read again only that review's subscription (`isAffectedByReviewSubscription`), and
  show the outcome at once, as the server records it (`subscriptionAfter`: subscribed by hand, or unsubscribed), so the
  button doesn't flip back while that read runs.
- Nothing shows while it's read, when the read fails (a server without the command: no error, the section is optional,
  and it isn't asked again while that failure is kept, `asksForSubscription`, so writes and Refresh don't repeat it)
  or when the repository sends no review emails (`emails` "disabled", also when the user can't see the trigger): a
  button that changes nothing they'd notice would be noise.

## The conversation

- One `cm find changereviewcomment "where reviewid = N order by date asc"` reads everything said on a review
  (`FOUND_REVIEW_COMMENTS`, `conversationOf`): the comments, each with its kind (`ReviewCommentKind`), the comment it
  replies to (`{parent}`), where it is (`{revisionid}`, `{itemid}`, `{path}`, `{location}`, `{changeset}`), when it was
  edited (`{modifieddate}`, the creation date when never edited) and the changeset that applied a change request
  (`{appliedinchangeset}`). The server writes its own notes among them (`timeline`), their meaning in a prefix of the
  text: the description is the newest `[description]` one; the others are events (`ReviewEvent`): review requests
  (`[requested-review-from]a;b`; an older server's `[requested-review-from-<id>]` names no one), a reviewer asked
  again or removed, a status with what its reviewer said (`[status-reviewed]…`), a rename (`[renamed-title]a#->#b`).
  A merge request's notes (its state moves, its destination, its branch hidden) are events too: docs/features/merge-requests.md
  "The page". A note this version doesn't read is left out of the timeline (`other`, `isShownEvent`), never shown as
  the server wrote it.
- It reads under the reviews' area (`useReviewConversation`), so every write on a review reads it and the lists again,
  their counts changing with it (`isAffectedByCodeReviews`), and a focus once stale reads it, as others write on it.
- The tab (`ReviewConversationTab`) shows, oldest first as a conversation reads: the description (its band in the
  accent's tint, apart from the comments' neutral ones, saying who "wrote the description" or "opened the review",
  `descriptionHeader`; edited in place;
  an emptied one clears it, `cm codereview -e --descriptionfile`), then the threads and the events by when each
  started (`timelineOf`), then a field for a comment on the whole review (`cm codereview comment add`; one on a line is written from the code, see "Comments in the code"). Oldest first
  is deliberate: replies and events only read in order (requested, commented, applied), and newest first would
  scatter them; what's new is reached from **Open** and by settled threads folding. Three or more reviewer changes in
  a row (asked, asked again, removed) read as one line that lists each under it on a click, and folds them back on
  another (`foldReviewerChanges`). What its
  author did to themselves reads so ("added themselves as a reviewer", "left the reviewers"). Beside it, the
  reviewers (see "Reviewers and their status"), **Open**: the change requests and questions still open
  (`ReviewSideRail`, `openItemsOf`), **Notifications** (see "Email notifications") and, for a review of a branch,
  **Branch attributes**, edited in place as the branch's details show them, Add at the title's right and "No
  attributes" when it has none, without the details' card (`BranchAttributesSection`, `useAttributesSection`; hidden
  with nothing to show or add, `attributesSectionOf`).
- **Going to a thread** (`threadPick`): a click on an Open entry, or the page opened at a thread ("Show in
  conversation", from the code), makes that thread the current one (`pickThread`, `pickOnFocus`). Its card is brought
  into view (`pickedBehaviorOf`, `placeInView`): from Open it glides, the page opened at it jumps at once, and either way
  its card lands a fifth down the viewport, even when already on screen (ARCHITECTURE.md "Going to a thing"). It goes
  there once the conversation is laid out for good (`conversationLaidOut`: read, and the review's changesets settled,
  as they group the entries into rounds and move the threads below). It's unfolded, lit for a moment
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
  `focusChangeset` for one written in a changeset's diff; see "Comments in the code"), then, apart and as text, the
  line it was written on ("line 1962", `writtenLineText`). Not "file:line" as the link: it read as going to that line,
  which an outdated comment's no longer is, and only the name looked clickable. Not a "Show in code" button: on every
  card, even shown only under the pointer, it was noise. Not the whole card: in the conversation a card is read, replied
  to, folded and selected. Its header is one quiet line: its folder (giving way first in a narrow card), file and line
  (`locationText`), then a pill on the right saying what the thread is and where it stands (`HeaderPill`, `pillOf`). In the code, where the file is the one shown, the
  header names only the line (`ThreadHeaderView.line`): a thread can sit rows below its line, or away from it once
  outdated.
  The pill leads with the kind's icon (`THREAD_KIND_ICONS`, change request, question or comment), and its words say
  only where it stands (`threadBadges`), as the server counts open ones. The icon's own tooltip names the kind where the
  words don't (`HeaderPill`'s `kindTip`): hovering the icon shows "Change request" or "Question", even on a pill that is
  a link, whose tooltip, over the rest of it, says what a click shows. Beside "Comment" the icon is only drawn, with no
  tooltip and hidden from a screen reader, so the kind isn't said twice. Open and Comment pills have no tooltip of their
  own. Where it stands:
  a change request is **Open** until a changeset applies it (**Applied**, the pill a link to how it was applied, its
  tooltip naming the changeset: "Applied in changeset 4: see how it was applied", `appliedPillTip`; shown in how it was
  applied itself, it only names the changeset, as opening it would go behind the dialog, whose footer opens it:
  `threadHeaderOf`'s `inContext`) or a reply discards it (**Discarded**); a question is **Open** until anyone replies
  (**Answered**: any reply answers it, there's no other way to resolve one). Other comments are never open: a plain
  comment on a line has the same pill, its icon and **Comment**, so every band names its kind in one spot (and has a
  pill, which the band's padding centers its text around). Its kind sat first as a small icon at the left, beside the
  file: the eye goes to the pill, so an open change request and an open question looked alike, and a plain comment had
  no icon at all. Not "Open request" and "Open question": the icon says the kind, the words only the state, as the
  settled pills' do. A settled
  thread starts folded to that line and its first words (`startsFolded`, `repliesText`), so what's open stands out; a
  click shows it whole (by keyboard, its fold toggle: the folded line is the pointer's way only, so it isn't a second
  tab stop). Every card with a header band folds the same way from its chevron, and in the conversation from anywhere on the band ("Foldable lines"): open change requests and questions,
  which start whole, and plain comments on a line too (`foldsByHand`: how a card starts and whether it folds are
  apart; `threadCardFold`). Folded, in the conversation and in the code, its first comment's menu sits at the end of
  the folded line, under the pointer, where the comment shown whole has it (`FirstCommentMenu`): the same entries,
  wired once (`useCommentMenu`), so "Mark as not applied", Copy, Edit and Delete don't wait for an unfold; Edit
  unfolds the card at the comment's editor. Not on the band: there, after the pill, it took room the band had to keep
  empty while the card was whole, which pushed every pill left of the open cards' pills. The Comments panel's cards,
  which go to the thread, have none. **Answered** is a link as **Applied** is, in the conversation and in the code
  (not the Comments panel's cards, which go to the thread): it shows the thread whole, scrolled to the reply that answered it,
  the first, lit for a moment ("Answered by Borja: see the answer", `answerOf`). Where it stands is an outlined pill,
  every one the same shape and border, the kind's icon leading its words: **Open** in the color of "Rework required",
  **Applied** and **Answered** in the color of "Reviewed", **Discarded** neutral gray, and **Comment** a muted violet
  (`--comment-kind-text`, `--comment-kind-border`; `PillTone`'s `comment`), a color no state takes. Not gray, which
  read as Discarded; not blue, the app's link color, which read as a link (and as the Comments panel's pressed filter
  chip); not teal, too close to Applied's green.
- **A question answered in a changeset**: an answer naming a changeset of the review's repository ("Fixed in
  cs:281301", the first one named in the replies, `answeringChangeset`) answers the question in it, as a changeset
  applies a change request (`ThreadState`'s `answered.changesetId`, `settlingChangeset`): that changeset's diff shows
  the question beside the fix (`belongsToChangeset`), **Answered** opens How it was answered on it where the card can
  show it (the card still unfolds to the answer, its fold toggle), and the dialog's button opens that changeset. A
  changeset another repository's (`cs:12@other`) isn't in the review's diffs, and answers nothing.
- **Chips in a review's comments** open a changeset of its branch in its Changes, selected, where the reviewer is
  (`reviewChipPage`, through `ChipOpenerContext`, which a page fills to open a chip first); anything else opens as every
  chip does (docs/features/rich-comments.md).
- Writing: every comment is written in the rich editor (docs/features/rich-comments.md) through `CommentComposer`,
  ⌘↵ sending it, its draft kept while the window lives (`useCommentDraftStore`) and cleared once sent or cancelled;
  each text reaches `cm` in a file. Reply (`cm codereview comment reply`), edit (`… comment edit`, the text only),
  delete (`… comment delete`, asked first), discard a change request with a reply saying why (`… reply --discard`).
- A thread's reply box follows its drafts (`useAnswerBox`), wherever the thread shows (the conversation, a line, an
  image, a model). A reply (or discard) left with words in it shows open with them when the thread shows again, a
  settled thread unfolded for it (`answerShownOnReturn`, `initialThreadCardFold`); a box emptied before leaving shows
  the "Reply…" prompt again. The same thread shows in both tabs, kept mounted: words written in one open the box in
  the other, its card unfolded if folded, and a reply sent or cancelled in one closes it there, unless the focus is in
  it, showing a discard still left if there is one (`nextAnswerBox`, `followDrafts`). The box follows each draft's
  state (none, emptied, words: `answerDraftOf`), not its text, so typing renders no other card. Only a box opened by
  hand ("Reply…", "Discard…") takes the focus. A draft in a folded round of the conversation stays hidden until the
  round opens.
- Who may do what (`commentPermissions`), as the official client allows it (the server only checks the permission
  on what the review targets): only its author edits a comment; only its author deletes it, and a thread's first
  comment only while nobody replied (`cm` would leave the replies answering nothing); anyone but who asked for it
  discards an open change request. A comment's menu (`commentMenu`) offers what the user may do, and its text and
  link to copy (Copy ▸ Comment, Link; see "Links to comments").
- **What a reviewer said with their status** is edited by that reviewer, in place in the timeline
  (`canEditStatusComment`, `statusCommentMenu`, `TimelineEventRow`), even when they said nothing; nobody deletes it,
  as the status would go with it. `cm codereview comment edit` writes the text as given and puts back only a
  description's prefix, so the service writes the status's own (`statusCommentText`, `editStatusComment`), or the
  edit would lose the status.
- **Marked applied by hand** (`changeRequestMarkOf`, `markChangeRequest`): a change request's menu, in the conversation
  and in the code, marks an open one **Mark as applied…** and an applied one **Mark as not applied**, for anyone
  signed in, its author too (anyone may check in its fix). Not a discarded one, nor a reply. `cm` takes a changeset to
  mark it applied in (`cm codereview comment apply <guid> --changeset=cs:N`), so the changeset picker asks which
  (`pickChangeset`'s `among`): a branch's review lists its branch's changesets, newest first, the newest ready for
  Enter (`changesetsToApplyIn`, the read its Changes tab lists them by, so no new command); any other review the
  repository's newest. Any other changeset of the repository is typed by its number, as `cm` takes any. Mark as not
  applied runs at once (`cm codereview comment unapply <guid>`), unasked: marking it again is as easy. Each is one
  quick write (`query()`) refreshing the reviews only (`isAffectedByCodeReviews`), the pill and the open count with
  them. Both rely on the version reviews need, ungated (see the top of this doc).

## Links to comments

A comment is linked to by the review's link and its id (`…/code-reviews/311/-/comments/5702`, docs/features/deep-links.md):
`{id}`, short and the server's own, never its GUID. Its menu's Copy ▸ Link copies it (`reviewCommentCopyTexts`),
wherever the comment shows: a card in the conversation, a thread in the code, a reply in either. The description has no
menu and no link of its own: it is what the review's link opens on, the conversation's first card.

A link opens the review where the comment is, decided from the conversation as read (`commentLinkPage`), which the link
reads first with the review itself, and the page then finds both read (`reviewConversationQuery`, `codeReviewQuery`): no
command of its own.

- A comment on a line, or a reply in its thread, opens Changes at the thread, in the mode it was written in, as its
  file's link in the conversation does (`commentLocationPage`): under its line, or among the outdated above the code
  for one on an earlier version whose line changed. The thread shows whole, its replies with it; the reply isn't lit
  there, the thread is.
- A comment on the whole review opens the conversation at its thread, a fifth down, unfolded, lit and ringed, as "Show in
  conversation" does. A reply opens it at the reply (`focusReply`, `pickOnFocus`'s `replyId`): the reply brought into
  view and lit rather than the whole card (`threadMarkOf`'s `litReply`, `pickedElementId`), its round unfolded. The
  card decides what it lights from its props (`cardLightOf`), so one mounting at the reply, a link opened cold, lights
  it from its first render; the conversation scrolls to it, the reply itself only for the Answered pill
  (`CardLight.litComment.scrolls`). Between the pill's answer and a reply gone to, whichever came last is lit, each new light restarting on the same reply too (`commentLightShown`).
- The description's id opens the review as the review's link does, without saying it's not found.
- A comment the review no longer has (deleted, or never on it) opens the review on its conversation, and a toast says
  "Comment not found" (`LinkNotice`). A review that isn't there lists no comments: its read fails, and its page says
  so alone, as does one whose conversation can't be read.

## Applying change requests

A change request is applied the way `cm` has always applied one: a check-in whose comment names it,
`[apply-change:c0d1ce00]`. `cm checkin` and `cm changeset editcomment` find it anywhere in the comment as written (its
words in any case), match it against the change requests pending on any review of the repository, and mark it applied
in that changeset. The short form, the guid's first eight hex digits, matches only in lower case, as the guid's digits
are written; the whole guid matches in any case (`applyChangeMatches`, `shared/applyChange.ts`). The app writes the
text and runs no command of its own for it, so every client reads it. A shelve applies none. Marking one applied by
hand ("Marked applied by hand" above) is for a request a check-in didn't name.

- **Writing it** (docs/features/rich-comments.md "Suggestions"): in the check-in's comment, typing `[apply` (`cm`'s own
  syntax, `changeRequestQueryAt`) opens **Change requests to apply**: the open ones of the reviews of the workspace's
  branch that the comment doesn't name yet (`notYetNamed`), the newest first; what's typed after `[apply-change:`
  filters them by their words, file, review, author or number, and a pick writes the whole `[apply-change:c0d1ce00]`
  (`changeRequestSuggestions`). `cr:` stays a review's spec only: a request isn't a review, and mixing them under one
  prefix read as one. The discoverable door is the description's footer (docs/features/changes.md "The check-in's
  comment"): a quiet button with their count, there only while some are offered, which opens the same list at the
  description's caret, or at its end, and teaches `[apply` at the list's foot (`suggestionListHint`). It always opens:
  asked before the editor loaded, the list opens as it does. No combo of requests and no banner: the official
  client's list in the check-in was in the way of every check-in, and most have nothing to apply.
- **Where** (`changeRequestsBranch`): a check-in on a branch, never a shelve or a workspace on a changeset, a label or a
  shelve. A changeset's comment edited in its details panel applies them too (`cm changeset editcomment`), but offering
  them there would read the branch's reviews for every changeset selected; one typed by hand there still applies and
  shows as its chip.
- **What it reads** (`useBranchChangeRequests`, `branchChangeRequestsOf`): once the pending changes are read, so it
  never holds up the list, one `cm find review "where target = 'br:/main/task'"` (`CodeReviewFilter.targetBranch`,
  `branchReviewsKey`; `cm` fails for a branch that doesn't exist, which offers nothing), then the conversation of each
  of its reviews with something open (`{unresolvedissues}` above zero, `reviewsToRead`; a branch has one, rarely two),
  under the very key its page reads it by (`reviewConversationQuery`), so the page and the check-in find each other's
  read. A review that couldn't be read hides none of the others' requests. A branch with no review, or none open,
  costs the one find, which the top bar's merge request chip shares (merge-requests.md "Where a branch's merge
  request shows"). Open is what the conversation says (`threadsOf`'s state: not applied, no discarding reply). Read
  again only on an event: the branch switched (another key), a write on a review (`isAffectedByCodeReviews`), a
  check-in, an update or a switch (`isAffectedByCheckinOrUpdate`: what came in may have applied some); never on a
  focus (`SLOW_CHANGING_QUERY`). It isn't checked again right before a check-in: that would add a find to every
  check-in, and `cm` checks the requests itself (below). One find of every open change request of the repository
  (`type = 'change' and appliedinchangeset = -1`, as `cm checkin` asks) was rejected: it grows with the repository's
  history, needs a second find for the discarding replies, and shares nothing with the review's page. `cm find
  changereviewcomment` can't filter by a review's target.
- **A request no review has pending** (applied already, discarded, no request by that number): `cm` makes the
  changeset, or saves the comment, then fails listing those requests, and applies none of the requests the comment
  names. The app reads that failure as done (`changeRequestsNotApplied`, by structure: a list, after a colon or a
  full-width one, of only requests the comment names, wherever the message puts it, as English, Japanese, Korean and
  Chinese do; a `cm shell` joins each item's line to the one before, `…changeset:- deadbeef`), takes the new changeset
  from the workspace's status (a local read), and says "No change request was applied: … is applied already, or no
  review has it open" (`changeRequestsNotAppliedText`), never "Check in failed", and marks `cm`'s failure handled, so
  the status bar shows none.
- **A recent comment picked** (`recentCommentPick`) leaves out the requests it applied (`withoutApplyChanges`): no
  longer pending, they would make `cm` apply none in the new check-in. The words around one keep a space between them,
  and a line left empty goes, so its paragraph stays one; a comment whose title was only a reference opens with its
  description as the title. Recent comments names each comment by what its pick writes (`recentCommentLabel`).
- **After the check-in** (`withChangeRequestsApplied`): a check-in or a comment edit whose comment holds such a
  reference (`appliesChangeRequests`) refreshes the code reviews too, so their Applied pills, their Open counts and the
  footer's count follow.
- **Reading it**: anywhere a comment shows, the reference is a chip reading "Applies:" and the request
  (docs/features/rich-comments.md "How references show").

## Suggested changes

A change request can suggest the code itself, as GitHub's suggested changes do: a fence whose language is `suggestion`,
holding the lines that replace the commented ones. It is plain text in the comment (`suggestionOf`,
`lib/reviewSuggestion.ts`), so the official client and the web show a code block, and no `cm` command or server field is
involved. A suggestion replaces the lines its comment is on, one or a range (see "Lines a comment is on"). An empty
fence deletes them, several lines replace them. Everything takes the comment's `LineRange` (`{ firstLine, lastLine }`,
one line when they're equal): the block's removed rows, Suggest change's prefill, following the lines into the
workspace's file (`suggestionTargetIn`, see "Applying a suggestion"), writing them (`withLinesReplaced`) and the reasons
("Lines 13–15 changed…", `rangeWords`).

- **What counts** (`suggestionOf`, `suggestedChangeOf`): only a change request on a line holds one, as only those are
  applied (`[apply-change:…]`); a fence in a question or a comment is a code block. Only the comment's first such fence
  of its own counts (backticks or tildes, words after `suggestion` allowed, the fence's indentation taken off each
  line); one in a quote, a list or another fence is code. It's read by the comments' own Markdown reader
  (`suggestionFenceIn`, micromark), as the comment shows it (`suggestionBlockIndex`), so a fence is a suggestion exactly
  where the comment shows its box (`markdownSuggestion.test.ts`). A hand-written fence reader was dropped: it read a
  fence inside a list item, which Markdown shows as the item's code, so the comment had a suggestion with no box.
- **Writing** (see "Writing from the code"): the new line comment's **Suggest change** (`suggestButtonOf`) inserts the
  fence at the caret, on lines of its own, filled with the line's text as the diff read it (`withSuggestionAt`,
  `useReplacedLines`: the diff's own read, no command), the caret at the end of the line, and makes the comment a change
  request. While it's written, the fence's code is colored in the commented file's language, as the box shows it once
  sent (`commentedFileLanguage`, given by `CommentedFileContext` in a line comment, its replies and edits), from the
  moment the editor learns the file, not only once the code is typed into (`colorsRedrawn`). It's offered once per
  comment, as only the first fence counts. The code's menu has **Suggest change on line 42** (or **on lines 40–42**, the
  lines selected) after "Comment on line 42"
  (`LineAction.variant`), opening the comment with the fence in it (`useNewLineCommentsStore`'s `suggestRequest`); when
  it can't fill one (the line can't be read, a suggestion is there already), the card says why rather than opening
  without one (`suggestRequestOutcome`), until the comment changes (`refusalShown`). A fence a line of code would close
  takes more backticks (`suggestionFence`). Editing a change request on lines offers it too, in its header beside its menu
  (`editOffersSuggestion`, `EditSuggestButton`), so a request posted without one can take one; disabled, saying so,
  once the text suggests already. Not in a reply, which has no line of its own and is never a change request, nor in
  the editor of a question or a plain comment, whose kind stays once posted: the fence can be typed there, a code
  block.
- **Reading** (`SuggestedChangeBlock`): in place of the fence, wherever the comment shows whole (the conversation, the
  cards in the code, How it was applied), a **Suggested change** box: the diff of the commented lines to the suggested
  ones (`suggestionBody`, `suggestionFileDiff`), drawn by Pierre as the code's diff is, so its colors, change bars and
  word marks (`30` → `60`) are the diff's own (`SuggestionDiff`, `pierreSnippetDiffOptions`). Two views, the user's
  choice for every suggestion (`useSuggestionViewStore`, switched by the header's small **Stacked | Diff** control;
  the box clicked stays where it is on screen while every suggestion resizes, `keepElementInPlace`; shown only when
  the two differ, `viewsDiffer`: a suggestion keeping none of the lines it replaces, as most one-line ones, reads the
  same both ways):
  **stacked**, the default, as GitHub and GitLab show one: every line replaced, then every line suggested
  (`replacedThenSuggested`), each line edited marked against the line it became as the line diff pairs them, whatever
  lines the suggestion adds or removes (`stackedWordMarks`, drawn over the rows by `useWordMarks` in Pierre's own word
  colors; Pierre's own marks are off there, as it pairs the n-th line removed with the n-th added, which marks the
  wrong lines once the suggestion has another number of lines); and **as a diff**: the line diff of the two, the
  lines kept shown once and untinted, only the lines changed removed and added, their words marked (`suggestionLineDiff`). Three
  lines kept stay around each change (`SUGGESTION_CONTEXT_LINES`), and a run of more than ten kept lines folds behind
  a bar that unfolds it (`SNIPPET_FOLDS_OVER`, Pierre's `collapsedContextThreshold`): a method whose first and last
  lines change reads as its two changes, while a shorter run shows whole, as a bar to click there saves nothing.
  Stacked never folds: it is the old block, then the new one. Stacked reads a heavy rewrite best, where a diff
  interleaves pieces of both; the diff reads a few words changed in a longer range best, where stacked shows the lines kept twice. Both are
  numbered as the file's lines from the first one commented, in a diff kept whole, as Pierre loads the full files of a
  partial one. **Compare in a larger view**, beside it, opens the line diff in the code comparison dialog
  (`openSuggestionComparison`, the moved code's, `openCodeComparisonDialog`), wide enough for the two side by side,
  with the diff's own Split | Unified switch: a comment, as narrow as its thread, has no room for them. Its controls
  are words and a diff icon (a page with + and −): icons alone read only once used, and an expand icon read as "make
  the box bigger". One
  column, highlighted in the file's language (`syntaxLanguage`, once Pierre's shared highlighter has it:
  `useSyntaxHighlighter`), every line shown. A few lines, so drawn whole on the main thread: no workers, and no
  virtualizer, even inside the code's diff, whose own it would otherwise join. Inside a thread in the code, the box is
  a diff in the code's annotation row: its pointer events stay in it (`keepCodePointerToItself`), and the code's menu
  doesn't take its rows for the code's lines (`rowUnderPointer`). Its rows run edge to edge, from the header's border
  to the box's and from the change bar on (`pierreSnippetDiffOptions`); a long line scrolls sideways with the bar
  every code view has (`PaneScrollbars`), there only while a line overflows. "Suggested change: delete the line" for
  an empty fence. A suggestion of the lines as they are (Suggest change's prefill sent unedited) says "The suggestion
  is line 13 as it is" in place of a diff of no rows (`unchangedSuggestionNote`). The line is read from the revision
  the comment is on (`useCommentedText`): one immutable `contentQuery` under the key the review's diff reads it by, so
  in the code it's the diff's read, and in the conversation one read per revision, shared by every suggestion on it,
  and only by a comment shown whole (a settled thread starts folded); a revision the workspace has loaded is read from
  the disk. While it's read, and while Pierre loads with the first box shown, a place as tall as its rows holds it;
  lines that can't be read leave the suggested lines alone, added. One-line previews (the Comments panel, Open, a
  folded card, the "Applies:" chip) show the comment's first words; one that opens with its suggestion reads
  "Suggested change on lines 24–152" (`changeRequestLineText`, `suggestionNameOf`), as its first line of code (`{`, a
  method's signature) names nothing. Copying keeps the
  fence as written. ## Applying a suggestion An open change request's Suggested change has a split button in its
  header (`SuggestionApplyButton`):
- **Check in suggestion** asks for the check-in's comment (`CommentDialog`): "Apply suggestion from Ana", the request to
  apply in its description (`suggestionCheckinComment`; in the summary its chip, reading a line of code, wrapped and
  moved the buttons from under the pointer), then writes the lines and checks in that file alone (`checkInSuggestion`,
  `checkinChanges`). Its commands: one `cm status` (local) right before, then one `cm checkin` in a process; the views
  of the workspace's files and the reviews are read again as after any check-in naming a request
  (`withChangeRequestsApplied`). The comment isn't kept among the recent comments (`remembersComment: false`): it names
  a request that's applied once checked in.
- **Apply to my changes**, behind the caret, only writes the file (`applySuggestionToChanges`): the change is pending,
  and Changes offers the request in the next check-in ("Change requests to apply" above). That's the way to take several
  suggestions in one changeset.

Where it stands (`suggestionApplyOf`, from what the window read: `useSuggestionApply`, worked out again only when what
it reads changes; the button shows it through `suggestionApplyButtonOf`); no suggestion costs a command: a settled
request (applied, discarded) has no button. It's disabled, its tooltip saying why, for a suggestion of the lines as they
are (it changes nothing, wherever the workspace is); in a window with no workspace; for a shelve's review (on no
branch); in a workspace not on the review's branch (a changeset review's: its changeset's, which its diff reads,
`reviewBranchOf`; `cm wi` tells the workspace's, locally); behind that branch, as the incoming check last saw
(`behindBranch`, polled anyway); when the version the suggestion was written on can't be read, or isn't text; and when
the file's lines no longer hold the text the suggestion was written on (`suggestionTargetIn`): the block of lines is
followed from the commented revision into the file on disk (the disk read is free) whole and with its neighbors
(`newerRangeInContextOf`): moved is fine, but any of its lines changed, or the line just before or after it (where the
revision has one), is not. A line diff pairs lines that read alike, and a short one (a lone `}`, a blank line,
`#endregion`) reads like many: alone it could be paired with another such line once code moved around it, and the
suggestion would be written there. When the lines are there but a neighbor changed, the reason says so ("The code around
line 3 changed…", `codeAroundChangedReason`); when they already read as suggested, in the same place (after Apply to my
changes), it says the workspace already has the suggestion (`ALREADY_APPLIED`): for a deletion, when its lines are gone
and the lines before and after them meet as the removal left them (`deletionNeighbors`, `deletionApplied`); at the
file's start or end, the one neighbor there is sits at the file's edge too, or the line beyond it is the deleted one,
changed. A deleted line moved elsewhere reads as applied: it's gone from where the suggestion pointed. The file must be
UTF-8 text, as the app reads files (`toFileContent`): a replacement character means another encoding, which writing back
would change.
A file with other pending changes takes Apply to my changes only: checking it in alone would take those too
(`checkIn.reason`).

**Right before writing**, both actions check again (`writeSuggestion`): the user may have edited the file between seeing
the button and clicking it. The file is read again and its lines followed as the button did (`suggestionTargetIn`), and
Check in suggestion first reads the pending changes afresh (`cm status`, local), not as the window last saw them. On a
mismatch nothing is written, and a toast gives the reason the disabled button would have ("Line 13 changed since the
suggestion was written", "Settings.cs has other changes…").

Writing (`withLinesReplaced`) changes those lines only: the others, their line ends (the last replaced line's own in a
file of mixed ones), a last line without one and a byte order mark stay. The text shows at once and the views of the
workspace's files are read again, as a discard in the diff does (`showFileText`, `refreshFileViews`). As everywhere the
app writes a workspace file, it doesn't check it out first: `cm` finds the change by its timestamp; a read-only file
fails the write and says so. A check-in that fails (a lock, the server) leaves the file written, a pending change, and
says so: the user asked for the change, and putting the old text back could lose an edit made meanwhile.

## Rounds

A review goes back and forth: the author checks in, a reviewer asks for rework, the author fixes and asks again. A
reviewer's status (Reviewed or Rework required) closes a **round**: everything up to it is reviewed for them, what came
after is new. Nothing is kept apart to know it: the server's note of each status says when it was given, and the
branch's changesets, read by the one `cm find` its Changes tab lists them by (`useReviewChangesets`, the same query, so
one read serves both), say what was checked in when (`reviewRounds`).

- **Where a reviewer left off** (`checkpointOf`, `ReviewCheckpoint`): their newest status that closes a round, and the
  newest changeset on the branch then. Under review (a request to review again) closes nothing. Each reviewer has their
  own; a member of a reviewer group who sets a status is noted under their own name, as the server adds them. A
  changeset checked in while the reviewer was still reading counts as reviewed: the server notes when a status was
  given, not what was read. Dates compare as instants, across time zones.
- **The changeset a status was given at** (`changesetAt`, `statusChangesetsOf`, `ReviewRound.changesetId`): every
  Reviewed or Rework required names the newest changeset on the branch then, what reviewers used to write by hand with
  it ("LGTM, cs 281866"). It shows once: on the round's line while the round is folded ("**Reviewed** by Violeta at
  281866", `roundText`), on the status's own event once unfolded ("marked it Reviewed at 281866", `reviewEventRow`).
  None for Under review, a status given before the branch's first changeset, or a review of a changeset or a shelve.
  It's named as words of the sentence (`ReferenceChip`'s `plain`): the changeset's icon and number in the line's own
  font and gray, the link color and an underline under the pointer, a chip's card and its click (it opens in the
  review's Changes). A dot parts it from the time after it, whose number it would otherwise run into ("at 9 · 5
  minutes ago"). A chip's fill, and the link color at rest, read as badges and drew the eye from the verdict. The
  round's line folds as every foldable line does ("Foldable lines", under "The conversation"); the changeset keeps its
  own card and click. Named only from the branch's own
  changesets (`ownBranchChangesets`): the previous review's, kept on screen while this one's are read, would name
  another branch's. Nothing is written to the server and the status popover says nothing of it: the server has no
  field for it (its note of a status holds only the comment), and inferring it costs no read.
- **New to them** (`newThreadIds`): a thread settled since (applied in a changeset checked in after it, by the
  changeset's date, or by its number when the branch's list doesn't hold it; answered or discarded after it), or with
  something someone else said since. What they said themselves is no news to them.
- **The conversation** (`conversationBlocksOf`) reads as one timeline, oldest first: a rail runs down through the
  events' icons, behind the cards. Each closed round starts at a line of its own, "Round 1 ·
  Rework required by you · 5 requests applied, 2 questions answered" (`RoundMarker`, `roundText`), counting every thread
  started in it, as one more event. Rounds are numbered only among others (`roundName`, `roundCountOf`): a review's
  only round reads "**Reviewed** by Alvaro · 1 request applied", its status bold where the name would be, since a lone
  "Round 1" hints at rounds that never came; a second round numbers both. Folded, the line is the verdict: its mark on the rail is the
  status that closed it (Reviewed's thumbs-up, Rework required's flag, in their colors), with its time, and what the
  reviewer said with it shows under the line, folded past
  four lines (`roundLineComment`), so the verdict and its words read at a glance. A click on its line shows what it held
  under it, at the timeline's own indent, ending with the status's own event, and folds it back. Unfolded, the line
  heads what the round held, with no verdict and no time: "**Round 1** · Ana's review · 5 requests applied", a review's
  only round "**Vio's review** · 1 request applied", the user's own "your review" (`roundText`), its mark the same
  status in gray. The status's own event at its end says the verdict, in color, with its time: repeated on top, with a
  time newer than the events under it, the round read as reviewed twice, its times out of order. A round where nothing is open
  starts folded, one with something open unfolded, and the round holding the thread the page goes to unfolds, even
  one folded by hand, a click on its line still folding it (`roundIsOpen`, `roundHolding`, `roundChoiceForgotten`). For a reviewer, the rounds are their own statuses'; for anyone else (the author), every
  reviewer's. Then, for a reviewer, the **New since your last review** line (`SinceLine`, `sinceText`): one more event on the
  rail, an accent dot breathing quietly (`--keyframes-heartbeat`, still under reduced motion), the words and their day,
  a hairline, and **See the changes →** at the end; the rail stays as it is (an accent segment read as a second rail).
  Not one pill of two halves, which read as a toggle. It shows when anything came after
  their last status; a thread of an earlier round settled since moves under it, when it settled: what they come back to
  check. The page opens scrolled to it once, unless it was opened at a thread (`opensAtSince`); a status set meanwhile
  moves the line, never the page.
- **Foldable lines** (`FoldableLine`): a round's line, a batch of check-ins and a run of reviewer changes fold with a
  click anywhere on them, their time and avatar too, while a link or a button inside (a changeset) keeps its own click
  (`rowTakesClick`, `clickedOutsideControls`); their chevron always ends them, after the time, and is the way to fold by
  keyboard, named by the line's words. A thread's band folds the same way in the conversation, its chevron leading, as a
  file's header does; in the code only its chevron folds it, since a click on a card there picks the thread. The
  chevron is the line's one tab stop. A chevron before the time, or a click that folded only on the chevron or the words, made lines that look alike
  behave differently.
- **The layout holds while the page is open** (`ConversationLayout`, `conversationLayoutOf`, `keptLayoutAfter`, kept
  by `useConversationLayout`): where each thread shows and whether each round starts folded are decided once, when
  who the user is, the conversation and the branch's changesets are read, each from the read the page started on
  opening, never a cached answer it is about to replace nor the previous review's changesets (`answerIsCurrent`).
  Afterwards, what the user or a refresh changes (a request marked applied or not, a reply, a discard) updates the
  card, its round's counts and Open in place: a thread shown never moves (marking it applied would otherwise take it
  under the "New since your last review" line, and unmarking it back), and a round never folds or unfolds by itself
  (settling its last open thread would fold it with the card under the pointer). What's new (a comment, an event, a
  check-in) is placed as on a first read; a round closed meanwhile (the user's own status, or for the author or a
  bystander anyone's) shows unfolded, since what it holds was on screen. The next time the page opens, it lays the
  conversation out afresh; so does a page window when it switches tabs or goes to a thread (Show in conversation),
  as each remounts its page (`pageKey` holds the tab and the thread). "How it was applied", opened from the
  conversation, steps through the threads where it shows them (`ContextRequest.steps`); opened from Changes, where a
  fresh read places them (`useReviewCheckpoint`).
- **What a reviewer said with their status** sits under its event in a soft tint, no bar beside it (the rail is the
  timeline's one vertical line: a bar beside it read as two), folded past four lines with "Show more"
  (`TimelineEventRow`, `FoldedComment`), as a status can come with a wall of text.
- **Check-ins** (`CheckinsEntry`, `CheckinsRow`): the branch's changesets checked in since the review was asked for,
  placed by date among what was said, one entry per run of one person's changesets with nothing said between them
  ("Daniel checked in 3 changesets"), its line folding the list under it. They start
  listed only under the "New since your last review" line, what a reviewer comes back to check; anywhere else folded to that line
  (`CheckinsEntry.startsOpen`): a long branch's first batch would push the conversation out of sight. Each changeset is named as a comment's chip names one (its icon and number,
  without the fill) with its comment's first line, and opens in Changes on it. Past five, the
  first ones and "N more" (`shownCheckins`). Changesets from before the review are left to Changes: a long branch would
  push the conversation out of sight. The changesets list no merges, so a merge from the parent shows as any changeset
  (telling one would take a `cm find merge` more).
- **In Changes**, the list of the branch's changesets marks them against where the user left off
  (`useReviewCheckpoint`, `BranchDiff`'s `reviewedUpTo`), or, for anyone who gave no status (the author), where the
  newest reviewer left off, naming them: "Reviewed by Miryam Gomez" (`reviewedUpToOf`, `ReviewedUpTo.by`):
  one "Reviewed by you · Nov 9" line with a check, in the Reviewed status's color, between what they
  reviewed and the first one new since, the list oldest on top (`reviewedSeparator`; no row, `DataTable`'s `separator`: the arrows and the selection go past it), what's
  under it new (`changesetMark`), and the reviewed ones a step quieter; no dot on each new one (docs/features/diff.md).
  At the line's end, **Show the 3 new** selects the new ones together, one diff (`ReviewedSeparator.showNew`); no New
  toggle keeps only them, the line says it. Several changesets selected show as one diff (docs/features/diff.md "A
  branch's diff"); **See the changes**, on the "New since your last review" line, opens Changes with the new ones selected together
  (`newChangesetsSpan`, `focusChangesets`). A span is never part of a link: what's new to one reviewer isn't new to
  whoever opens it. A page moved to while Changes shows already (a check-in, Show in Changes, See the changes) reaches
  it as a request (`changesFocusAskedFor`, `changesFocusRequest`): a changeset the page names wins over the one a
  thread was written in.
- **How it was applied** opened at a settled thread steps through the others settled in the same part of the
  conversation, in the order it shows them (`stepGroupsOf`, `contextStepsOf`; from the conversation, as its kept layout
  shows them: "The layout holds while the page is open"; "Round 1 · 2 of 4", "New since last
  review · 1 of 3", "After round 2" for someone with no line of their own ("After the review" past a review's only
  round, whose own threads show the position alone, as before any round); a pager
  above the title, its arrows first, where it is seen first and never moves): stepping stays in the part being read, so a round closed long ago doesn't mix with what a reviewer came
  back to check. A step shows the next one's own view of how it was settled, away from the file it was opened from;
  only the dialog's body changes, never the dialog (opened again, its animation flickered at each step). Beside the
  header's view switch, whose label changes width ("How it was applied", "Since then"), the arrows moved at each step.
  Its footer leaves the dialog for the review's Changes, at the thread (`showInChangesPage`, `contextFooterAction`):
  **Open changeset N** for a request applied on a branch, whose diff shows it beside the fix; **Show in Changes** for
  anything else, where it was written.
Tried and dropped, so they aren't proposed again: banners under the header saying whose turn it is (they repeated what
the conversation shows once it opens at its line, and read as stress); a band under the Changes header saying what's
reviewed; a third mode "Since last review" in Changes (several changesets selected in the list give the same diff); a "New"
chip in the files' filter bar (it's full); earlier rounds as scopes ("Since round 1": All changes covers going further
back); Applied as a jump to Changes (it loses the reviewer's place; the dialog handles fixes in other
files, "marked applied with no file" and reviews of no branch); a column in the list saying why a review waits; and
a line in the Review popover saying what a status covers ("Covers everything up to changeset 17": it said little,
and added noise to the popover); rounds as boxes, indented, which broke the timeline into pieces; and rounds as hairlines across it, centered, whose
ragged ends and broken rail read untidy: a round is one more event on the rail; and a round shown by its status alone, what led to it opening above it (the
verdict moved to the bottom as it opened: the round's line stays where it starts).

## Comments in the code

The Changes tab (`ReviewChangesTab`) shows what was said on the code where it was said, from the conversation already
read (`useReviewConversation`): no other `cm` read, but the earlier versions of a file below.

- **Files with comments**: in the list of files, a comment icon by the status letter of each file holding threads in
  the diff shown, how many in its tooltip, and a **Commented** chip after the status chips showing only them
  (`reviewFileFlag`, `fileThreadCount`, through `EntryFlagContext`). It counts every thread, whatever the Comments
  panel's Open/All shows, so the icon and the chip agree, and from the threads alone, as the list reads no file
  (gathered by file once per diff: a list of thousands of files reads each thread a few times). See in
  context's list marks the commented file the same way, with no chip (`commentedFileFlag`).
- **Lines a comment is on.** One line or a range of them, of one revision (`ReviewCommentAnchor`, `LineRange`). `cm`
  stores where a comment is as text, counted from 0 (`{location}`; `commentedLinesOf`): `11` is line 12, `lines:11-17`
  lines 12 to 18 (written by `cm codereview comment add --line=12-18`; `lineOption`), `-1` no line (a comment on the
  review, or on a whole file). `{line}` names a range's first line only, so it isn't read. A point or an area of an
  image is `image:…` (see "Comments on images"). Any other location a client writes with `--location` (a point of a 3D
  model), and a comment on a whole file, reads as a comment on the review for now. A thread on a range sits under its last line, as GitHub's do, and its
  outline runs from its first (`PlacedThread.firstLine`, `LineBand.firstLineNumber`, `rangeBox`), on out of view when
  an end is past the rows a big file renders (`LineBox.outside`, `renderedEdgeOf`); a folded region inside it unfolds
  (`rangeLinesOf`). It names its lines as "lines 12–18" (`rangeWords`): its header, its marker, See in
  context's title and views, an outdated thread's snippet (every line of it marked, the first ten of a longer one,
  `snippetOf`), and a change request to apply (`Player.cs:12-18`). The Comments panel orders it by the line it sits
  under. The needed `cm` is the one the app pins (docs/features/cm-runtime.md), so nothing checks its version.
- **Where a thread goes** (`threadsOfFile`, `fileCommentsOf`). A comment is on lines of one revision of a file
  (`{revisionid}`, `{location}`), found in the diff by its path or the path the file moved from. On the revision the
  diff's newer side shows, it sits under its line; on the one its older side shows (a file the review deletes, which
  `cm` comments on its last revision), under that line on the left. On an earlier version of the file (the reviewer
  commented at cs:8, the author checked in cs:9 and cs:10), that version and the newer side are read
  (`versionsToRead`, `useFileVersionTexts`: one immutable read each, only for a file shown that has such threads; the
  file's threads on earlier versions wait until every one is read or has failed, so a row placed never moves for
  another arriving, Pierre keeping rows by their place, `placeEarlier`; one whose read failed holds none of the
  others, and its threads are outdated, their line known though not their text; a purged one reads as empty), and
  the lines are followed into the newest version (`newerLineFinder` and `rangeIn`, a line diff ignoring line ends; a
  range only while every line of it is there, unchanged and together): unchanged, the thread
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
  so, the subtitle saying it was marked applied there, not applied: `notInChangeset`; for a file that changeset
  replaced, `DiffEntry.replaced`, usually to make it a move of the file it replaces with its contents kept, the move:
  that file before the review, from the review's whole diff, against what the changeset left, the thread on the right,
  the header naming the move and the subtitle "after changeset N made it a move of X", `replacedHistoryOf`; with no
  move in the review's diff, or that read failing, the plain comparison, saying why it may read the same: compared with
  the version commented on, it read "No content changes", as if nothing applied it), or
  the review's newest version (its whole diff's, never a changeset's). A view waits for the diff it reads, says so when
  that read fails, and why it has nothing to compare otherwise (`contextComparisonState`). Every **Applied** pill (the
  code, the Comments panel, the conversation) opens it on How it was applied, and every **Discarded** pill (and **Answered** in the Comments panel, whose cards show no
  replies) on Since then, the request against the newest version beside the reply that discarded it (`HeaderPill`'s `context`); the tag
  opens it on When commented. No
  separate "See in context" button: beside the tag and the pill, a third control opening the same dialog read as
  something else. Its one button leads to the code (`contextFooterAction`): **Open changeset N**, for a request applied on a branch,
  opens that changeset in the review's Changes, at the thread, beside the fix; anything else, **Show in Changes**,
  where it was written. A changeset applying a request on a review of no branch isn't among its changes, and opens on
  its own page. Two buttons, one to the review's Changes and one to the changeset's own page, read as the same twice. When that changeset changed other files too, the
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
  review's whole diff ("All changes on …", or several changesets as one) or one changeset picked in the list
  (`reviewDiffViewOf`). Going to one selects that (`threadDiffRequest`, `DiffFocusRequest`; from a page, `focusChangeset`). A changeset's diff shows
  the threads written in it and the change requests it applied, on the version they were written on, so the fix reads
  beside what asked for it (`belongsToChangeset`); the whole branch's also shows those written in a changeset's diff that are on a
  revision it shows, or whose line is still there in the newest one (an outdated one is left to its changeset's diff),
  so an open change request never hides behind the mode it was written in. A review of a
  changeset or a shelve has one mode. Files under an xlink are another repository's, and have none.
- **Hidden.** The file header's comment button (`useReviewCommentsStore.inCode`, one setting for every review) hides the
  threads from the code, and the pins from every image and model, in every file at once (its tooltip says only which way it
  goes, Hide or Show comments, the same for code, images and models: `commentsToggleLabel`; "in every file" and "on the
  model" read as more than a show-or-hide switch): each line holding some
  keeps a marker at its end (`LineMarkers`, `shownThreadRows`), showing who wrote there and how many comments there are,
  as a pull request's do (`markerPeople`, `markerCommentCount`), in the Open color while anything there is open
  (`markerIsOpen`). Its tooltip previews each thread there as plain text, its first words (cut at a word about 80
  characters in) over its kind, where it stands, who started it and its replies ("Question · Open · Borja · 1 reply"),
  three at most and then how many more (`markerTip`); not the line, which it's on, nor who wrote there, which its
  avatars show; a screen reader still hears the kind, the line and the people (`markerLabel`). A click opens that line's
  threads, and going to a thread opens its line; hiding again closes every line opened (`openedAsCommentsToggle`), the
  thread selected included. The outdated ones hide too, and keep a marker of their own on the
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
  width less the files' as they were left, `pageDiffFilesWidthOf`, and the panel's, `diffWidthBesidePanel`, each
  side's half of it side by side), decided as the changes first show, so a first comment doesn't open it, and the user's own choice is kept for the next review:
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
    and a row goes there. Each thread is a row (`ThreadSummaryRow`, header place `fileGroup`): who started it, "line N"
    and its replies, then the conversation's pill (its kind's icon and its state, **Comment** for a plain one); its
    first words under them, as wide as the row. A line number in a column of its own read as an id, and the icon beside the words took their room. In a narrow
    panel, who started it is cut first, then the replies, the line last; a place naming a model's part ("point on
    Wheel", `writtenPlaceNamesPart`) can be long, so it's cut first instead, at most half the row. The one gone to has
    the accent bar on its left.
  - **Newest first** and **Oldest first**: by the latest comment or reply in each thread, so a reply brings an old
    thread up; one list, as the conversation sums up a settled thread (`ThreadSummaryCard`; its file and line only name
    where it goes, cut short in turn, the folder first, then the line, the file's name last, and whole in a tooltip).
    Grouping by file would cut the time order apart, so a time order never groups, and grouping is not a choice of its
    own.

  It opens on Open when anything is open (`initialCommentsFilter`). For a user back after a review of theirs, **New**
  sits between Open and All (`commentsFilterChoices`): the threads new to them since their last review (see "Rounds",
  `newThreadIds`), and the panel opens on it when anything is new, once where they left off is read
  (`useReviewCheckpoint`'s `settled`), so it doesn't open on Open and stay there. A row under the header narrows it further: words
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
- **Writing from the code.** A line of the revision the diff comments on takes a comment, and so do the lines selected
  in the gutter (a click on a number, Shift+click or a drag for a range, as for a link): the newer side's (context
  lines too), or a deleted file's, which `cm` comments on its last revision; never the older side of a changed file,
  nor a removed line in unified layout, which the reviewed revision doesn't hold (`lineCommentAt`). Files under an
  xlink and directories take none, as they hold no thread (`isCommentable`); images take theirs on the image (see
  "Comments on images"), and binaries and 3D models wait for
  their viewers' own way in. Two ways in, both the diff's `lineAction` (`ChangedLines`): a "+" by the line under the
  pointer, lines with threads included (a new change request isn't always a reply), on the lines selected when it's
  one of them ("Comment on lines 40–52", `lineActionTargetAt`), and "Comment on line 42" first in the code's menu, on
  the lines selected (`lineActionTarget`), "Suggest change on line 42" after it (see "Suggested changes"). The "+"
  also drags, as GitHub's does (its tooltip says "Drag for a range", `lineActionTip`): pressed and moved over other
  lines of its side, they're outlined in the accent with a "+" on the first and the last (`useLineActionDrag`,
  `LineActionDragMarks`, `lineActionDrag.ts`), and released, the comment opens on all of them; released on its own
  line, it's a click, and Esc drops it. No gutter selection while dragging, and no text selected: its fill across both panes was noise
  for a comment. A line joining the two "+" was tried and dropped: it ran over the code's first letters. Once a
  comment opens on lines selected, the selection lets go (`releasingSelection`): the comment's outline marks them,
  and the selection's fill under its card was noise. Lines a comment is being written on take no other comment while it is
  (`crossesCommentBeingWritten`): no "+" there, no menu entry, no drag or selection across them, as two comments being
  written over the same code read as one. The same lines go back to the comment being written. A selection
  across both sides of a unified diff is one line (`linkedLinesOf`), as its link is. No key: a review's diff has no
  caret, so no line is "current". The comment opens under its last line (`NewLineCommentCard`), scrolled into view
  and focused if it isn't in view (`openedSpotRow`: unfolding the lines a range crossed can push it far down), after the line's
  threads, its lines outlined in the accent as the card is (`withNewLineCommentRows`, `withNewLineCommentBands`), never in a side panel
  as the official client's: it's written where it's read. Its kind comes first, as it can't change once posted: Change
  request (the default, `DEFAULT_LINE_COMMENT_KIND`), Question or Comment, the placeholder and the button following it
  ("Request change", "Ask question", "Comment": `lineCommentWords`). A kind clicked gives the focus back to the text,
  its caret where it was, so typing goes on; picked with keys (← →, Space or Enter), the focus stays on the switch, as in any
  radio group (`focusFieldAfterPick`, `segmentPickOfClick`). The cards on an image and a model do the same, and a
  model's "Point" or part too. ⌘↵ sends it at once, as every comment is (`cm
  codereview comment add <id> --revision=revid:N --line=L|A-B --type=Change|Question|Comment`, and `--changeset=cs:N`
  on one changeset picked in the list, so it shows in that changeset's diff: `addLineCommentArgs`); its row then holds the new
  thread, opened even while comments are hidden (`openedOnSend`): the card stays, sending, until the conversation read
  again holds it (`conversationReadSince`, which waits for a read after the write, `conversationReadAt`, the one the
  write asked for, and reads nothing itself), so the line never shows nothing in between. Cancel or Esc drop it, asking first once words were written
  (`asksBeforeDiscarding`). Comments being written are kept while the window lives (`useNewLineCommentsStore`, their
  text in `useCommentDraftStore`), so going to another file, mode or tab and back finds them under their lines:
  nothing asks to save one on the way, as the official client's Yes/No/Cancel did. One takes the focus only when
  opened (`focusRequest`, `focusOnRequest`): shown again as its file is, it leaves the focus where the user is (going
  through the files). It's kept by its file and line numbers, not the revision: a branch's newest revision changes as
  its author checks in, and the comment stays at its line number, going on the revision and side shown then (a file
  deleted since, on its last revision: `newLineCommentsIn`). The code at that line may have changed meanwhile: the
  reviewer sees it before sending, and following the line through the change would need the versions read for every
  comment being written. A file moved since, or now shorter than the line, shows it no more; its text stays kept.
- In the code, a thread is the conversation's card (`ReviewThreadCard` with `inCode`): no file (it's at its line),
  its kind in its pill as everywhere (no kind's name beside it as well, which said it twice),
  replies, edits, deletes and discards as in the conversation, and its first comment's menu leads to **Show in
  conversation** (the Conversation tab scrolled to it and lit, `showInConversation`: the page moves to it in place,
  as its tabs do; never stacked, both tabs staying mounted as they were left, so Back leaves the review).
- A line a thread is on is never hidden in a folded unchanged region: the diff unfolds it (`DiffAnnotations`,
  docs/features/diff.md "Rows under lines").

## Comments on images

An image of a review's diff takes comments on a point or an area of it, as code takes them on a line or a range
(`ImageAnnotations`, given to the image viewer by `ReviewFileAnnotator` through `useReviewImageAnnotations`; the diff
knows nothing of reviews, docs/features/diff.md "Comments on images").

- **Where it's stored.** `cm codereview comment add --location=image:x,y` for a point, `image:x,y,w,h` for an area, on
  the revision the diff comments on, as lines are (`addImageCommentArgs`, `imageLocationOption`, `spotCommentAt`).
  `cm` stores the text as given and doesn't read it; every client reads it alike (`commentedImageSpotOf`): the image's
  own pixels from its top-left corner, x right and y down; an SVG's numbers may have decimals; what follows a `;` is a
  hint a client may ignore. The app writes whole pixels. `ReviewCommentAnchor`'s `image` kind holds it (`ImageSpot`);
  a thread on a file, its lines, its image or its model, is a `FileThread`.
- **Pins.** Each thread shows as a speech bubble holding the avatar of who started it, its tip on the point, or on the
  top-left corner of the area it outlines (`reviewImagePinsOf`, `ImageCommentsOverlay`): who wrote there, as a line's
  marker shows, the shape of a comment on a canvas as design tools draw it. Numbers were tried and dropped: an avatar
  says more, and the Comments panel and the conversation name it "point" or "area" beside its file
  (`writtenPlaceText`), its pixels only in the tooltip, rounded: "A 40 × 30 pixel area of the image at x 1, y 2"
  (`writtenPlaceTip`). The bubble is always white with a soft shadow (`--image-pin-rim`, `--image-pin-shadow`), so it
  reads over any image; where the thread stands is a mark on it, never a color the image could swallow: an
  Open-colored dot while open, faded once settled, an accent ring around the avatar when selected (a state border,
  then a bubble filled with the state's color, each vanished over an image of that color). Its tooltip opens above
  it, its caret on the bubble wherever the cursor is on it (`data-tip-side`, `placeTooltip`): under the bubble is what the comment is about, which the reader looks at while
  reading it. An area is drawn as the one dragged to write it: a 2 px line in its state's color over a faint wash of
  that color, so the image reads as it is (a 1.5 px line with a light halo was tried and read as a washed-out double
  border over images), and it shows only while its
  bubble is pointed at, its card open, or it's being written (its thread staying selected once the card closes
  doesn't keep it), as design tools do: every area drawn at
  once hid the image under their outlines. In every image mode, on the
  side its revision shows (Split's After pane; Onion, Diffs and Swipe lay both over each other), gliding with the
  zoom.
- **A thread** opens beside its pin on a click, one at a time: the conversation's card as a line's thread shows it in
  the code (`SpotThreadCard`, shared with a model's), its × closing it back to its pin. Esc closes it too, wherever the keyboard is in
  the Changes tab (the Comments panel, the file list), not only on the stage: a command (`useLeaveCommentCommand`,
  decided by `leaveCommentCommandOf`), so a field, a menu or a dialog keeps its own Esc and Expand Diff's Esc waits for
  it. Only a viewer with a card open or a spot being marked registers it (`leaveCommentCommands`): every image and model
  viewer in the app uses the same command id, and the commands keep one per id (`registeredCommands`), so an idle
  viewer registered later would hide this one. Going to a comment leaves the keyboard where it was,
  so N and P keep stepping from the panel. It goes right of the pin, else left, else
  below or above it, whichever has room, never under the stage's controls, and over the pin and its area only when
  nothing else has room (`cardPlacement`, `pinBounds`). Going to it from the Comments panel, the keys or the
  conversation opens it and brings it into view at the zoom shown (`transformShowing`): the whole area when it fits, else its
  corner with the bubble (`revealedRect`): the reviewer keeps the zoom
  they chose.
- **On an earlier version** (written on a revision neither side shows), a thread's pin goes at its spot on the side
  comments go on, dashed, its card tagged "Earlier version" (`imageEarlierTagOf`): an image has no lines to follow, and
  what's there may have changed. No "outdated" for images, nor See in context: a pixel comparison to tell whether the
  spot changed is a later step.
- **Writing.** The stage's comment button, or **C** (`imageComment`), turns the pointer into the pin's bubble with a
  plus (`--cursor-add-comment`), the shape the button (`CommentPinIcon`), a comment being written and a posted one
  share; a click marks a point, a drag an area, outlined as it's drawn (`spotOfGesture`, a
  press off the image marks nothing), and the card opens beside it (`NewImageCommentCard`): its kind, then the editor,
  as on lines, with no Suggest change. Esc (`imageCommentLeave`) or the button leaves the mode. Until it's sent, its bubble drags it
  (`movedSpot`) and its area's corners reshape it (`resizedSpot`), kept within the image; it's kept while the window
  lives (`useNewImageCommentsStore`), by file, named by a serial so moving it changes nothing else, on the revision shown, as one on lines is. Once posted it stays
  where it was written: `cm codereview comment edit` changes a comment's text only.
- **Hidden.** The header's comment button hides the pins, the one selected included, and the comments of every other file with them (see "Hidden" under
  lines), to look at the image alone; one
  gone to while they're hidden shows, as a line of code opens (`threadShownWhileHidden`).
- **An SVG** shows as code or as the image it draws (docs/features/diff.md "Images written as text"): comments on its
  lines are in its code, those on a point or an area in its image. Each view says how many the other holds ("2
  comments are on the image", Show image: `otherRepresentationNotice`), and going to a comment shows the view it's on, for that
  file only (`fileCommentsSummaryOf`, `RepresentationCommentsContext`; taken once, `askToTake`, and shown for that file alone,
  `shownRepresentation`).
- **Not yet**: EXIF orientation (a rotated JPEG's comments are in the pixels as shown, not as stored); an SVG's spots in
  its own units (they're in the pixels it's drawn at, `decodedSize`, which an SVG declaring more than 16 MP, or no
  size, is drawn at scaled: another client reading its viewBox's units would misplace them); and a pin moved once
  posted (it needs `cm codereview comment edit` to take a location).

## Comments on 3D models

A 3D model of a review's diff takes comments on a point of its surface or on a whole part, as an image takes them on a
point or an area (`ModelAnnotations`, given to the model viewer by `ReviewFileAnnotator` through
`useReviewModelAnnotations`; the diff knows nothing of reviews, docs/features/model-diff.md "Comments on the model").

- **Where it's stored.** `cm codereview comment add --location=model:x,y,z[;node=<path>][;local=x,y,z][;part][;view=dx,dy,dz,d]`
  on the revision the diff comments on (`addModelCommentArgs`, `modelLocationOption`; the grammar is in
  `modelCommentLocation.ts`). The point is in the file's own units and axes, so every client places it alike from the
  file; the rest are hints a client may ignore: the part's names from the root down, the root itself (the file or its scene) not named, so `Car/Wheel` is a
  top-level `Car`'s child (`node`, each percent-encoded), the point
  in that part's space (`local`), the whole part (`part`), the camera it was written from (`view`). Past `cm`'s 1,024
  characters the hints go, the camera first, then `local`, then the part (`modelLocation`); the point always stays.
  Numbers keep eight significant digits, never an exponent (`locationNumber`). `ReviewCommentAnchor`'s `model` kind
  holds it (`ModelSpot`); other clients read it as a comment on the file until they learn it.
- **Pins** are the image's bubble (`PinBubble`, `reviewModelPinsOf`): who started it, an open dot, faded once settled,
  ringed when selected. The Comments panel and the conversation name the place by its part, so comments on one model
  read apart: "point on Wheel", or a whole part "on Wheel", the part alone (`writtenPlaceText`). The name is the last
  of the location's `node` path; no file is read and no `cm` command runs.
  With no `node` hint (another client's, or one past the length limit), an empty name, or a name an exporter gave
  ("Mesh", "mesh_0", "Object_12", "polySurface3", Maya's "pCylinder3", Blender's "Cube.001"; a bare "Plane" reads as
  written: `partNameSaysNothing`), it says only "point" or "part". The tooltip gives the part's whole path, empty names
  left out: "A point on Car › Wheel", "The whole part Car › Wheel" (`writtenPlaceTip`). A comment on a part lights
  the part up only on demand: its bubble pointed at or focused, its card open, or while it's written
  (`litCommentPart`).
- **On an earlier version** a pin shows on its part as the version shown has it (`local`), dashed and tagged "Earlier
  version"; when that part is gone, at its point, the tag saying so by the part's name, "Wheel isn't in this version"
  (`modelEarlierTagOf`). No earlier version is read.
- **Writing.** The stage's comment button, or **C** (`modelComment`): a ring lies on the surface under the pointer
  with the part's name beside the cursor, and with Shift held the whole part lights up instead (`hoveredPartOf`,
  `hoverLabelOf`; docs/features/model-diff.md "Comments on the model"); a click marks a point (`spotOfHit`), a Shift-click the whole part
  (`stageClickOf`), and the card
  (`NewModelCommentCard`) offers its kind, then what it's about, "Point" or the part by its name (`modelCommentAboutOf`,
  `spotAbout`), then the editor. Before it's sent its bubble drags along the surface. It's kept while the window lives
  (`useNewModelCommentsStore`), named by a serial. A drag still turns the model: a box drawn in 3D would mean something
  else from every angle, so a whole part is what an image's area is here.
- **Going to it** glides the camera to the view its author had, else facing the point with part of the model around it
  (`viewOfSpot`), and opens its card.
- **Hidden.** The header's comment button hides the pins, the one selected included, and the comments of every other
  file with them (see "Hidden" under lines); one gone to while they're hidden shows, as on an image. An OBJ shows as its code or its model: each view says how many comments the other holds.
