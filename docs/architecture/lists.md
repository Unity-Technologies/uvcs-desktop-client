# Lists, filters and details

How every list reads and works: filters, list and details, details panels and splitters, big lists, long names,
item rows, lists of changed files and file icons. The summary every change respects is in `docs/ARCHITECTURE.md`
"Renderer".

- **Filters**: every list's filter marks what made a row match, by the same rule. A filter field takes each word typed
  in any order, each found in one of the texts the row shows (`matchesWordFilter`; users by the name shown and as
  stored, `userFilterTexts`), and `HighlightQuery` marks those words in each cell; a path cut to fit finds them in the
  whole path first (`PathLabel`, `positionsInTrimmed`). Words are found in the lower-cased text and marked where they
  are in the text itself (`lowerCasedText`): a letter may grow when lower-cased (a Turkish İ), moving what follows.
  Fuzzy finders (the palette, Go to file) pass the positions they ranked by (`fuzzyMatchPositions`). Text a row shows
  but its filter doesn't look at is never marked.
  - **The palette's branches and labels** are found by name (fuzzily) and by the words of their name and description,
    the list filter's rule over texts lower-cased once per list (`createWordFilterIndex`), from the every-branch and
    every-label lists it reads anyway (their `cm find` already prints the comment): no command of its own. Each
    keystroke looks at every row once, those holding the words together as typed first. A description hit ranks a
    tier below the same match in a name (`DESCRIPTION_MATCH_PENALTY`, `tierBelow`) and shows its description in place
    of the detail, cut to keep the longest word typed in view (`excerptAroundMatch`); a row whose description shows
    none of the words (the name held them, or a link's hidden address did) is a name hit, with its usual detail. The
    words are looked for in the description as written, Markdown and all, as the Branches view's filter does. The
    owner isn't searched there: a person's name would list every branch they made. Hidden branches are searched too,
    the user may be on one: `cm find branch` leaves them out of the every-branch list, so the palette reads them apart
    (`onlyHidden`, one quick `find branch where hidden = 'true'`, cached as slow-changing beside it and refreshed by
    hiding or unhiding through `isAffectedByBranchList`; `paletteBranches` joins the two). Their rows say "hidden", like "current" and
    rank half a tier below a visible branch that matches as well (`HIDDEN_BRANCH_PENALTY`; `lowered` rounds both
    penalties to hundredths).
  - **One filter bar**: every view lays its filters out with `FilterBar`, whose slots fix the order: the text
    (`FilterField`, "Filter <things>", 240px), people, time (`SincePicker`, the presets of `lib/sincePresets`, any time
    last), kinds and statuses (`ToggleChip`, `ChoiceChip`, the Branch Explorer's Branches picker, Changesets'
    `BranchScopeFilter`; a picker's options above its list are `FilterOptions`), then the view's own
    options at the end (layout, the graph's View). The text field is where ⌘F (and / from outside a text field) goes
    while it shows (`listFilter`, in its tooltip and the shortcuts sheet); ↓ goes on to the list and Esc empties it,
    then goes back to the list. Changes' and a diff's file filters take it too (`useChangeFilter(..., true)`); a list
    inside details keeps a plain `SearchField`; the command log keeps its own ⌘F.
  - **People**: `PeopleFilter` is the one people control: Mine, a click away, joined to a picker of anyone the list
    shows (`PeoplePicker` over `FilterChecklist`, which the Branches picker uses too: a search matching
    `userFilterTexts`, marked with `HighlightQuery`, Everyone and You first, then the people picked when it opened and
    the rest by name, avatars, several at once, only the rows in view rendered; ↑↓ move, Enter toggles, Space toggles
    once the arrows moved, Esc empties the search then closes). It reads the pick: "Ana Diaz +2", avatars stacked
    (`lib/peopleFilter`: `othersLabel`, `describePick`, `stackedPeople`). The people offered come from the rows: a list read whole
    offers its owners, one read by people on the server everyone it showed this session (`usePeopleSeen`); no query
    lists people. Where the view reads a subset from the server (Changesets, Branches, Labels, Shelves, Merge requests)
    the pick goes into that same query (`pickedOwners`: `me` and names, sorted, one key per pick; `ownersCondition`
    ORs a few owner names, never ids, at most `MAX_PICKED_PEOPLE`), once picking pauses (`PICKING_PAUSE_MS`), and the
    rows already read narrow at once meanwhile (`matchesPeople`). Locks read only the user's (`--onlycurrentuser`)
    or everyone's, other people picked among everyone's; the Branch Explorer fades the others' changesets
    (`pickedNames`), History and Attributes filter what they read. Merge requests have two people chips: who created
    them, and their reviewers (I'm a reviewer is the server's `reviewer = 'me'`; others picked narrow the rows read,
    code-reviews.md "The list"). `cm find` fails on an owner it doesn't know, so only people from the rows are offered.
  - **Branch** (Changesets): one chip, `BranchScopeFilter`, for every branch's changesets, "This branch" (the one the
    workspace is on, followed as it switches) or any branch picked from the switcher's list (`branchSwitcherGroups`
    over `useBranches`, the every-branch read the switcher, the pickers and the palette share, asked for only once the
    popover opens); no query of its own lists branches. The branch goes into the view's `cm find` (`toQueryFilter`,
    `branch = '…'`), so "This branch" and the same branch picked by name share one query key. A branch picked by name
    says which workspace it was picked in (`PickedBranch`, `branchScopeIn`): the store outlives the workspace a window
    shows, and another repository may have no such branch. A branch's menu, in every place it shows the Branch
    Explorer included, opens the view on it ("Show changesets", `showBranchChangesets`). Both ways pick it alike
    (`pickedBranchFilters`): its whole history (Any time, capped) by everyone, the text emptied, and nothing the view
    remembers changed. The pick holds its own time range and people for the session, which the chips show and edit
    (`shownFilters`, `shownFiltersChange`); All branches, This branch or Clear filters drop it, and the remembered ones
    show again. Clearing the remembered filters, or picking with Any time written into them, was rejected: a "Mine ·
    Last month" user was left on "Everyone · Any time" for good, a heavier read on a big repository.
  - **Remembered**: each view keeps its filters in one store (`createViewFilters`): the time range, the kinds, the
    view options and Mine across sessions, the text, the people picked by name and what else holds the repository's
    objects (`forSession`: a branch picked by name) for the session, as they differ between repositories; a page's
    (History) last as long as it. Older stores' `onlyMine` and the Branch Explorer's
    own date ranges are read into these (`restoredFilters`, `sincePresetOf`).
  - **Counts and empty lists**: the header counts what shows, "12 of 340" while filters hide some of what was read
    (`shownCount`). A list its filters empty says "No matching <things>" with Clear filters (`NoMatches`), which
    empties the text, shows everyone and turns the kinds off (`clear`, `isFiltering`); the time range stays, and the
    hint says when a longer one could find more (`longerRangeHint`). A list with nothing to filter shows its own first-use empty state, in the details pane (renderer.md "One layout from the first frame").
    Revealing a row the filters hide clears them (Show in Locks, the Branch Explorer's reveal).
  - **What shows is what goes in**: Changes checks in and shelves only the checked changes its text and status filters
    show (`checkinSelectionOf` over `ListedChanges`, given `useChangeFilter`'s `visible`); a file under a collapsed
    folder or changelist still goes in. Those the filters hide keep their check for when they show again, and the button
    counts what goes in; while the filters hide every checked change, its tooltip says so (`checkinDisabledReason`).
    The one exception: what a shown change needs to go in goes with it, hidden or not (a private file's private folder
    while filtering by Changed: `neededWith`, cm-output.md "Parsing `cm` output"), and the button counts it.
    Review mode's "Unreviewed" filter doesn't narrow it: it hides each file as it's reviewed, and those are the ones to
    check in. "Check in this changelist" clears every filter, "Unreviewed" too, so all the changelist shows and goes
    in, with what it needs. Checking in every checked change, those the filters hide too, with a notice saying how many, was dropped: a
    filter on Changed left the private files it hid checked, and they went into the changeset unseen.
  - The shelves list in Changes stays a quick list with "Mine | Everyone" (⇧⌘S), not a filter bar: it's a popover
    over Changes, and its "All shelves" hands its scope and text to the Shelves view.
- **List and details**: `ListWithDetails` (each view remembers its own details width, `detailsKey`; a file tree keeps its own width instead, `sized="list"`) around a `DetailsPanel`. A view listing objects lays its body out with `ObjectListView` (the table with a row always selected and its details, a skeleton of them while loading, its empty state in the details pane, `NoMatches` under the column titles, or the error) and refreshes with `ViewRefreshButton` (`listViewsRefresh.test.ts`). Every
  kind reads the same way: the kind and status badges with the default action (what Enter does on the row) and the row's
  context menu behind "More actions"; a `DetailsHeading` (the comment's first line as the title and the rest as its
  description, or the object's name with the comment below; folded to a few lines with "Show more" and "Show less" by
  `FoldedComment`, which a diff's header shares, see `features/diff.md` "The diff's header"; read as Markdown with chips for what it names, features/rich-comments.md; edited in place where cm can edit it, the title in a field that wraps and grows, and a comment left unedited saved as it was, `editedComment`; the comment saved shows at once, not the old one until the refresh reads it, `shownComment`; a name reads a size above a comment's title); a meta row (author ·
  date · spec to copy · branch chip); properties and relations behind "More details". The header says what the object
  is and nothing more: everything else is a titled section under it (`DetailsSection`, a caps title over a tinted
  card, a small control such as Add or New at the title's right, one look in every section: `DetailsSectionAction`),
  what the object relates to or how it stands first (Merge request, Review, Reviewers, In progress), then its attributes (`AttributesDetailsSection`: "Attributes", or "Branch
  attributes" on a review; Add at the title's right while there's an attribute to add, the card holding the chips or "No attributes",
  `attributesSectionOf`; never chips in the header, `detailsPanelsShowAttributesInSection.test.ts`). A
  panel that is mostly properties (a lock, a folder, the workspace) shows them in a "Details" section instead of behind
  More details. Then the changes pane under a remembered splitter (`DetailsChangesPane`), its title a disclosure once the list is read
  that hides it and shows it again from the cache, remembered for every panel as More details is (`changesCollapsed`). cm edits changeset, attribute, branch, label and shelve
  comments (a branch's with `cm branch editcomment`, the comment in a file; a label's by applying it again to its
  changeset, `labelCommentArgs`; a shelve's as the changeset below zero it is, `cm changeset editcomment cs:-<number>`,
  `shelveCommentArgs`, see `features/shelves-and-switching.md`). Selecting a row must stay cheap (Server
  budget: Selection); the changed files' `cm diff` runs only on request (`ChangedFilesSection`). The panel's parts are
  primitives of their own in `ui/` (`DetailsSection`, `DetailsEmpty`, `DetailsSkeleton`, `DetailsBadge`,
  `DetailsCopyable`, `DetailsLink`, `DetailsDisclosure`, `MoreDetails`), each imported from its own module. Lists are
  a `DataTable` (`ui/table/`: only the rows in view render; a cell is as tall as its row, so a corner badge or a lifted avatar
  isn't cut; the columns' sort, the keys' steps `selectionStep`, and
  `selectFirstRow`'s successor selection each in a module of their own). Arrowing renders the view on every step, so
  it hands the table the same `rows` and `rowKey` until they change (memoized, or built outside the component), and
  the same `columns` when they sort: new rows or a new key make it key every row again, a new `sortValue` sort them
  again. The sort keeps each column's ranks by column id
  (`ColumnSorter`), so a new `sortValue` function costs a number sort, never comparing the rows' text again.
- **Hiding the details**: every view and page laid out with `ListWithDetails` hides its details and shows them again
  the same way, remembered per view by its `detailsKey` (`detailsHidden`, `useDetailsPaneStore`): the
  `DetailsToggleButton` rightmost in its header (`ViewHeader`'s `detailsToggle`; `detailsPanelsHide.test.ts` holds every
  one to it), ⌘I or Ctrl+I, View ▸ Toggle Details and the palette's "Hide or show details" (`view.details`), which reach
  the view or page in front, not one hidden under a page (`toggleDetailsInFront`); the Branch Explorer's Space too.
  Hidden details aren't mounted, so they read nothing, and the list takes the whole view without being mounted again
  (`SplitPane`'s `hidden`, `paneRole`). What only the details showed moves or comes back: an empty list's first-use
  state shows under its column titles (`objectListLayout`), a page window keeps following the selection (the view, not
  its details, calls `useShowInFollowingWindow`), and a link to a file's lines shows Browse repository's details again
  (`showDetails`). Panes that show a diff beside its files (Changes, Incoming, merge, History, a diff) are not details:
  they have no toggle. Their diff expands to the whole window instead, the merge page's aside (features/diff.md "Expanding the diff").
- **Splitters remember where they were dragged**, across pages and sessions: a details panel's width per view
  (`detailsKey`), and every other split of a page through `RememberedSplitPane`, its width under a key of its own in the
  same store (`detailsWidthOf`): Changes' (`pendingChangesList`), Incoming's (`incomingList`), the merge page's
  (`mergeList`) and History's (`historyList`) lists, and the files beside a diff, one width for every page's diff
  (`PAGE_DIFF_FILES_WIDTH_KEY`: a merge request, a review, a changeset, a shelve, a branch) and one for a dialog's (`DIALOG_DIFF_FILES_WIDTH_KEY`), which is
  narrower. A list beside a diff gives way first as the window narrows, the diff keeping 480 px (`restMin`), so a
  width left in a wide window never squeezes the code in a smaller one. Heights too: the command log's, a details panel's changes (`DetailsChangesPane`), the check-in message's,
  the changesets above a diff's files. A double-click goes back to the default. `splittersRemembered.test.ts` holds
  every `SplitPane` to it, each under a key no other splitter or details panel uses. An image's swipe divider isn't a splitter of the layout: it starts in the middle each time.
- **Big lists render only the rows in view**: anything a server can hold thousands of (branches, labels, repositories,
  users and groups) is virtualized, never a plain `.map` over every row: a 4,800-label `.map` built 29k DOM nodes and
  a 190 ms freeze on open. Pick from the virtualized pieces: `DataTable` for a view's list, `FilterChecklist` to check
  several in a filter's popover, `PickList` to pick one in a dialog (labels, users and groups: the search keeps the
  keys, `pickListKeys`), `BranchSearchList` for branches, and `RepositoryList` for the home screen's repositories,
  whose expanded workspaces are rows of the same flat list (`repositoryListRows`). The row holding the focus, or the
  one a field's `aria-activedescendant` names, stays rendered while it scrolls away (`keepRendered` in the
  virtualizer's `rangeExtractor`); a list whose rows take the focus themselves keeps it by the row's key, not its index
  (`repositoryRowIndex`), and acts on keys only from a row's own button, never its ⋯ menu's (`movesBetweenRows`). The filtering and sorting behind
  such a list is memoized on its inputs, so a hover or a key doesn't redo it (`memberCandidates` sorts once per list
  read). A suggestions list (`<datalist>`) holds the best few matches, never every object (`branchSuggestions`). A
  field that may hold any value or one of a server's (the New workspace dialog's repository) is a `ui/Combobox`: its
  arrow, or ↓, lists every option whatever the field holds, only the rows in view rendered, and typing narrows them
  (`comboboxState`: typing highlights no row, so Enter keeps a new name). A `<datalist>` was dropped there: Chromium
  lists only the options matching the field's text, so the arrow of a field prefilled with a dropped folder's name
  showed nothing.
- **Long names**: branch names run past 120 characters (`/main/child-br-cr-sample/empty-branch2/child_1/subtask/merge-test`),
  so nothing that shows one may overflow, wrap a row or push another control out. Each place names a branch one of two
  ways, by what it does with it:
  - **In words** (a button, a menu item, a title, a sentence, a toast, a progress card, a breadcrumb): by its own name,
    `branchLabel` (`lib/branchLabels`: the last segment, cut in its middle past `MAX_BRANCH_LABEL_CHARS`; a menu item
    keeps fewer, `serverMergeLabel`), two side by side told apart by `branchLabels` ("Merge merge-test into subtask").
    The full name goes in the tooltip where the control has one.
  - **On its own** (a row, a cell, a chip, a header, a field's button): the whole path fitted to the room by
    `PathLabel` (parents dropped from the middle, `/main/…/child_1/subtask`, then the last parent cut rather than
    dropped while `MIN_CUT_FOLDER_CHARS` of it stay, `/main/child…mple/subtask`, the name cut in its middle last: the
    one rule for every path and branch, `trimFolderToFit`), the full name in its tooltip; the Branch Explorer's canvas
    the same way (`fitBranchName`, a tooltip on a cut name), the merge page's title both branches together (`fitMergeTitle`). A table cell may show just the own name, its tooltip
    the path (Changesets' Branch column).
  - The full path stays in words only where the user must know exactly which branch: the confirmation to delete it,
    the rename dialog's description, the new branch's "A child of …" and "Full name: …". There it wraps anywhere
    (dialog titles and text break long names, `overflow-wrap`) rather than overflow.
  - Underneath, nothing can grow past its container: a button's text label ends in an ellipsis at its container's width
    (`ui/Button`), a dialog's primary button gives way before Cancel does, and a split button before the row it sits in.
  `scripts/sandboxes/long-branch-names.sh` builds a repository with such names to check a change against.
- **Item rows**: every list of files and folders reads the same (`components/`): Files and Browse repository, Changes
  (after its checkbox), the files of every diff and details panel, the merge page, Incoming, Go to file, the Undo
  dialog, the Locks view (a lock names no item type, and only files are locked). `ItemRow` lays out the icon, the name
  (cut first, in the middle as every path is: `PathLabel`), extras and, last on the row in one column, `ItemStatusMark`:
  the status letter (`StatusBadge`, the same tones and letters everywhere; its tooltip says what it means there), or a
  dot for a folder with changes inside. A moved file that changed shows its C before its M (`StatusMark.changedLabel`,
  in a diff's header too), and both filter chips find it (`statusTones`). A moved item's name and its M show the move on
  hover, through the one tooltip (`data-tip-move-from`/`-to`, `PathMoveLines`): the folder both paths share said once
  ("in"), then one line each for where it was ("from") and is ("to"), the paths monospaced and what the move removed and
  added tinted as a diff tints them (`pathChangeSegments`); a line too wide is cut where nothing changed, folders first
  (`trimFolderToFit`), never wrapped (`fitPathParts`). Wrapping the two whole paths was tried and rejected: a long path
  broke inside what the move added, and the shared folder, said twice, hid what changed. `ItemPathRow` is an item named
  by its path, the folders dimmed. Extras go in one order: tags (`ItemTag`: a merge), where a conflict stands (the merge
  page's icons, `ConflictStatusChip`, in Incoming too), the review mark, then `ItemMark`s by the letter, a quiet icon
  whose words are in its tooltip (`LockMark`: "Locked by ana in art-wk", someone else's in the alert tone). A mark that
  leads somewhere is a button, its tooltip saying where, that keeps the row's click and selection out of it; the row's
  menu offers the same to the keyboard: a lock mark ("· click to see all locks") and the file's "Show in Locks" open the
  Locks view on that lock (`showInLocks`, selecting it through `selectInView` before going there). Nothing but ignored
  items dims: a private item keeps its icon, its name a step quieter, and wears its P; ignored (and cloaked) ones grey
  out, icon and name, with no letter in Files; deleted ones are struck through, reviewed ones fade (`faded`) but for
  their review mark. Files marks what is notable only (a pending change, a checkout, a private item: `itemDecoration`);
  a list of changes letters every row, as its filter chips do. In Changes every folder holds changes, so only its own
  change marks it. The merge page's letter is what the merge does to the item (a directory conflict's, what the source
  did); `cm merge` names no item types, so a path with others under it is a folder (`mergeItemTypes`). Locks are read
  for pending changes only (Files, Changes): other lists would need a `cm lock list` of their own. Every lock is the
  Locks view's own query (`locksQuery`, scope `everyone`), one read for both; only the user's locks in this workspace
  are a read of their own (`mineInThisWorkspace`), asked once a lock holds a change. The Changes list
  renders its file and folder rows memoized with stable callbacks: holding ↓ over 100,000 changes re-renders none of
  them (0.5-0.6 ms a step). What each change adds to a check-in is worked out once a read (`checkinFactsOf`: its upload,
  whether a shelve takes it, the folder a private file counts in), and how many of the changes each folder holds can go
  in once a layout, counted where they are (`candidatesUnderRow`): a click on a box then asks each change once whether
  it goes in, under the check-in rules (`consistentlyIncluded`, below), in one pass that adds everything up
  (`checkinSelectionOf`). With every box checked and nothing filtered, nothing is asked (`everyCandidateIncluded`), and
  a folder holding every change shown takes its check from the count (`shownChecksOf`, `checkStateOver`); unchecked
  paths no longer pending don't count (`everyBoxChecked`). A click costs about 20 ms for 100,000 changes, 90 ms for
  500,000 and 170 ms for a million (a production build on a Mac); unchecking everything at once twice that.
- **Lists of changed files** read and work the same everywhere: Changes, every diff (changeset, branch, shelve, code
  review: `DiffEntryList`), the details panels' changed files (`ChangedFilesSection`), Incoming and the merge page.
  - **One order**: by path, folder by folder, names as people read them (`file_2` before `file_10`, case only between
    names otherwise equal; different names read the same, "v01" and "v1" or a name in two Unicode forms, by their code
    units, so each folder's files stay together): `comparePaths` (`shared/pathOrder`), used where the files are read
    (`mergedDiffEntries`, `mergePlanOf`) and by Changes (`sortChanges`, once a read: `useSortedChanges`; filtering
    keeps the order, and `layoutChangeRows` lays the changes out as they come). `cm status` prints the changes in no
    order, so Changes sorts them folder by folder (`sortByPath`): a million in 0.9 s, where sorting the whole list took
    2 s. A read that kept most changes as they were (`sharePendingChanges`, in any order) starts from the last order and
    sorts only the others (`sortedFromPrevious`): 0.1 s for a million with one file edited. A list and a tree show the files in the same
    order. That path order is the default and the one every list's items come in; a sort is laid over it.
  - **One sort, chosen**: by path (the default), name, status (in the chips' order, `toneRank`), extension or date
    (`fileListOrder`: `FileListSort`). Ties keep the path order: sorting is stable and the items come by path. A list
    sorts all its files; a tree keeps its folders in path order, first, and sorts each folder's files after them
    (`layoutPathItems`, `orderTreeRows`): a sort is about files, and folders keep their place as in a file browser. Only
    the path order costs nothing. The others put the files in a bucket per name, status, extension or date and compare only
    those (`bucketOrder`): files share names, and a million changes compared one by one by name took 4.5 s (now 3 s
    when every name differs, 0.5 s when names repeat). Every list, filtered as the user types (Changes over up to a
    million changes), ranks all its files once a read (`useRankedOrder`, `rankedOrder`) and picks what the filter
    leaves out of those ranks, a look-up each, never comparing names again: 50,000 files of a diff by name took 85 ms
    a key, now 2 ms. A read after files changed keeps the ranking of the same sort for the files still there and finds
    the others their places by a binary search (`rankList`): a million changes with one edited, 0.3 s. No direction:
    nobody reads a list of files backwards, except by date, newest first, the files without a date last
    (`FileListFacts.dateOf`). The dates cost nothing more: a change's is its file's on disk (`PendingChange.lastModified`,
    which `DiskDetails` already reads; a deleted file or a folder has none), and a diff's file's is its new revision's,
    which the same `cm diff` prints (docs/features/diff.md, "Dates"). The merge page and a partial workspace's Incoming
    have no dates: a menu offers Date only where the list's facts have dates (`viewOfferFor`), and shows the files by
    path while it is the sort chosen.
  - **One view, chosen in a menu**: the layout, List or Tree, the sort, and grouping by status, for every list at once
    and across sessions (`useFileListViewStore`, kept under the key `file-list-layout` it had when it held the layout
    alone, which took the one Changes kept first). Its menu (`FileListViewMenu`, decided by `fileListViewMenu` in
    `fileListViewMenuModel`) takes the room of one button and follows the status chips, so it is in the same place in
    each list; a details panel too short for a filter bar has it in its title. Its choices apply with the menu open, so
    the list behind it shows each. Its button is an eye, since it holds the whole view and not only the layout, and
    names that view in its tooltip ("View options: Tree, grouped by status"). Each list says what it offers
    (`FileListViewOffer`): Changes adds grouping by changelist; the merge page and a details panel offer no grouping.
    It ends with "Collapse all" or "Expand all" for a list with groups or folders (`fileTreeFoldingOf`, given by the
    list around its toolbar: `FileTreeFoldingContext`). The palette has its choices too (`fileListViewCommands`).
    Only a list's own modes come after it (`useChangeFilter`'s `actions`: the review mode toggle). Review mode stays
    its own button rather than a choice in the menu: it is a way of working that is turned on and off within a task
    (marks, the R key, the review bar), not how the files are laid out.
  - **One tree**: `layoutPathTree` (`lib/pathTreeLayout`) lays out any items with a path: a folder's row, folders holding
    only the next one sharing it ("deep/very"), and a folder that is an item itself (an added or moved folder) as its
    own row, with its status; a path listed twice (two conflicts on one path) is two rows, never a folder holding
    itself. Its work grows with the items and the folders, never with how deep they sit: in path order a folder's items
    are one run of the list, so a folder's or a group's row points into the list it was laid out from (`held`, an
    `ItemRange` of `lib/itemRange`: the list, which never changes in place, and where the run starts and ends) instead
    of copying it. What is drawn with every row walks its run without copying it (`forEachIn`, `countIn`; a count:
    `folderItemCount`, `rangeLength`; a folder's check, `checkStateOver`; its review mark, `groupReviewStatus`); only
    what acts on the files once copies them (`itemsIn`: a menu, a check, a review toggle). Each layout walks each path's
    folders in place: the folders around an item are those it shares with the one before (a row stays open until its run
    ends), a run's end is found by halves, and only the folders shown become strings. A folder copying its run, or
    cutting each path into a string per folder above it, costs files × depth on every key typed in the filter: 170 ms a
    key for 100,000 changes eight folders deep, 1.2 s for a million, where the run and the walk take 35 ms and 0.2 s.
    Every folder row is `TreeFolderLabel` (chevron, icon, name, and how many items it holds while closed);
    `FileTreeCell` indents rows to their level. Every list with its own pane draws indent guides (`FileTreeList`,
    Changes' `ChangesList`): a hairline down from the chevron of each group and folder holding a row. They are always
    on: a guide costs nothing to read past, and an option for it would be one more knob. Drawing the one holding the
    selected row stronger, as an editor's explorer does, was tried and dropped: it moved with every selection and read
    as noise, where the selected row's own highlight already says where it is. A details panel's short list draws none.
    A click, Enter, ← and → open and close folders (`pathTreeKeyMove`, `groupedTreeKeyMove`); a folder's menu and the
    review key act on everything in it (`itemsUnderRows`), and in review mode its mark marks every file in it, showing
    how far its review got ("2/5", `partialReviewCount`). Closed folders are remembered for the session per list
    (`useCollapsedFolders`: the Changes of a workspace, one diff, one details pane, one Incoming scope, one merge), so
    closing one in a changeset's diff leaves every other diff alone. A list is scoped by its workspace too
    (`folderListScope`): `/main/feature` or cs:3 name other things in another repository. A selection made from outside
    the list (a diff opened on a file, the merge page or a resolve run moving to a conflict) opens the groups and
    folders holding it, so its row shows (`useOpenToSelected`, `rowsHolding`); only a new selection opens anything, so a
    folder closed around it stays closed.
  - **One way to group**: a list whose files fall in groups (Changes' changelists, Incoming's conflicts with your
    changes and changes to apply, the merge page's directory conflicts, file conflicts and changes to apply) lays them
    out with `layoutGroupedTree` (`lib/groupedPathTree`): each group's header row (`TreeGroupLabel`: chevron, name,
    count, or what its items' progress says instead, `FileTreeList`'s `groupProgress`, the merge page's
    `mergeGroupProgress`; what it is as its tooltip), then its files as a list or a tree, a level in (`groupedRowLevel`). Groups close as folders
    do. Grouping by status is a choice (`groupByStatus`, off by default): each status the files have becomes a group
    (`statusGroupsOf`, in the chips' order, each file in its own status's, a moved file that changed in Moved), headed
    by its badge, inside the list's own groups when it has some (`withStatusGroups`, `TreeGroup.subgroups`: Changes'
    changelists, Incoming's), so every file sits as many groups in (`groupLevelsOf`). It was rejected once, when it was
    the only order: a row jumps to another group when its status changes, and a folder's changes split apart. As a
    choice made for it, that is what it asks for; a status group's checkbox checks or unchecks every change of that
    status at once, which the chips can't. A list whose own groups already say what happens to each file (the merge
    page) offers none (`GroupedFileListFacts.statusGroup` undefined).
  - **One list**: `FileTreeList` (`components/`) is every one of them but Changes, which adds checkboxes and drag and
    drop, and the details panes' short lists: the filter bar, then the rows, grouped or not (`useGroupedFileTree`,
    `useFileTree`), with a desktop list's selection of several rows and their menu, which acts on every item the
    selected rows stand for. A list renders its own rows (`DiffEntryRow`, `MergeItemList`'s) and adds its marks (a
    conflict's status, the review mark).
    Changes puts its `ChangesSummaryBar` (the checkbox for every shown change, their count and undo) between the filter
    bars and the rows: it acts on what the filters left, in the rows' checkbox column; above the filter, it read as
    acting on every change. Every file list with its own pane (Changes, the diffs, Incoming, the merge page, while it
    calculates too) stacks its filter bar and review strip in `ListToolbar`, a rule under each: the filter's is as tall as the pane toolbar across the split (`--pane-toolbar-height`), so their rules meet,
    and rows without column titles keep `--space-1` off the rules above and below them, room the virtualizer owns so a
    row scrolled into view shows whole (`DataTable`'s, as Changes'). A details panel's short list keeps its bar unruled.
  - **One menu**: a file's menu is `changedFileMenu` (`components/`) in every list but Changes: its history (annotated
    or not), "Open this revision" and "Save this revision as…" for the version the list shows (a diff's newer side, a
    merge's incoming version; nothing to open for a deleted file or a folder), and Copy; a list adds its own after the
    shared entries of each group (a diff the review mark and, on the workspace's own history, reverting a file to before
    the change or restoring what was deleted, `diffEntryMenu`, features/diff.md "Reverting a file" and "Restoring
    deleted items"; a merge the ways to settle a conflict,
    `mergeItemMenu`). Nothing is read to build it: what Open and Save as take out of the repository is a
    `RepositoryVersion` (a revision, or a path or item at a changeset, as a merge knows its sides), read when they run.
  - **Folders once**: a folder added or deleted along with what it holds is left out, its items say it already, but a
    moved one stays, a move listing the folder alone (`withoutRepeatedFolders`, `lib/enclosingFolders`: `listedEntries`
    for a diff, Incoming and a details panel's changed files, so their counts agree; `buildMergeItems` for a merge). A
    folder whose Unity `.meta` changed alike stays too, for the meta to ride on its row rather than show alone
    (`hasMetaAlike`).
  - **A Unity asset with its `.meta`**: Unity writes `X.meta` beside every asset and folder `X`, and the two change
    together, so every list shows the pair as the asset's one row, tagged "+ meta" (`MetaTag`; its tip says so and, in
    Changes, that what the row does takes the meta along), and counts rows (`pairUnityMetas`, `lib/unityMetaPairs`:
    `pairPendingMetas` for Changes, `pairDiffMetas` for a diff and a details panel's changed files, `pairIncomingMetas`,
    `pairMergeMetas`); Changes adds the metas apart ("6 files + 2 meta", `changesCountLabel`) so its list adds up to the
    changes pending its header counts (ignored, cloaked or hidden items the list's options show aren't pending). A meta
    joins its asset only when both are listed and changed the same way (the same kinds and changelist in Changes, the
    same status in a diff), with the name matched exactly as Unity writes it; otherwise it keeps its own row, so nothing
    that changed alone is hidden. A conflict never joins: each is a decision with its own panel (Incoming keeps a
    colliding meta apart; the merge page every conflict). Pairing is always on, not tied to a Unity project: a `.meta`
    beside its asset means Unity.
    What changes data takes the meta along (`withMetas`): Changes' checkbox, undo, add, checkout, changelists and filter
    rules; a diff's revert and restore, whose "Restore to…" goes away when the meta comes back too, as an asset moved
    without it would lose it. What views or opens an item takes the asset alone, and one asset's menu adds its meta's
    own: "Open .meta diff" (`metaDiff`), "View .meta history" (`metaHistory`), and in Changes "Open .meta". Selecting
    the row shows the asset's diff; the `.meta` toggle in the diff's toolbar, there whatever the asset's diff is (text,
    image, model, binary, too large: `LoadedFileDiff`'s `compareControls`; `MetaDiffButton`, `diffedItem`), right
    before the change arrows so it doesn't move as the asset's and the meta's controls differ, or "Open
    .meta diff" shows the meta's, until another row is selected (`useDiffMetaShownFor`, Changes' `useMetaShownFor`).
    "Since review" shares that slot, whatever the diff is: a committed file's (`EntryDiff`) compares the reviewed
    revision with the current one, which an image or a model shows as for any two revisions; in Changes it needs a
    snapshot, which `ReviewStore` keeps only of text files.
- **File icons**: `ItemIcon` draws every file as the same filled Lucide page (`--icon-file` on `--icon-file-fill`) beside solid
  folders (`itemIconShape`), so every row reads with one weight, and an xlink as the same solid folder with an arrow
  badge cut into its bottom-right corner (`FolderXlinkIcon`: one color, the cutout and arrow transparent), in every list (Files lists an xlink as a directory, so its row passes `xlink` for the icon alone): it
  never reads as a directory; where it points shows on selecting it (`xlinkSummary`, `XlinkDiff`); a glyph on the page tells the
  file's family (`fileFamilyOf`, by name
  first, then its longest extension: `Form.Designer.cs` before `.cs`), and only the glyph takes the family's tint
  (`FAMILY_GLYPHS`; its outline of the page stays neutral, found by its corners). The families are what matters in a
  change: what you write (source `<>`, scripts) in `--icon-source`; what builds it (`.csproj`, `.sln`, `.props`,
  `package.json`, `Cargo.toml`, `CMakeLists.txt`, `Makefile`, `.gradle`, `Dockerfile`, `.asmdef`: a cog) in
  `--icon-project`; what's generated for you (lockfiles, Unity's `.meta`, `*.g.cs`, `*.Designer.cs`) as the plain
  page, like an unknown type; config and data (braces) in `--icon-config`; images and media in `--icon-media`; Unity
  and other game assets (a box) in `--icon-asset`; docs, archives and binaries with a neutral glyph. Each tint is 3:1
  on the page in both themes.
  Already tried in the real rows and rejected, so don't propose them again: Material Icon Theme, Symbols, JetBrains New
  UI and Seti (glyphs of uneven weight, rows look unbalanced; gaps for Unity, Go, Rust, lockfiles), Fluent (one icon for
  all code, licensed for Microsoft-connected use only), file-icon-vectors and Phosphor (extension letters unreadable at
  16 px), catppuccin, vscode-icons, file-icons, and native icons (`app.getFileIcon`: a generic page for paths not on
  disk, bitmaps that ignore the theme, different on every OS).
