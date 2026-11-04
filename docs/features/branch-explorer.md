# Branch Explorer and branch switcher

`features/branchExplorer` (layout in `model/`, drawing and hit tests in `canvas/`) and the branch switcher. The view
(`BranchExplorerView`) wires pieces that each own one concern: the history filtered and laid out (`useGraphLayout`),
the search (`useGraphSearch`), the keys (`graphKeyboard`), what Enter and a double-click open (`openSelection`), and
the canvas it drives through `GraphCanvasHandle` (`graphCanvasHandle`).

## Scale

Repositories reach ~280k changesets and ~20k branches. Layout packs branches into rows with a binary search per row
(`placeLanes`); a frame draws only what reaches the screen (`lanesAcross`, `mergeLinksAcross`), and what it asks of
every branch on screen is measured once per layout (`graphExtent`, `roomBeforeNextLane`, `nextColumnOnRow`). Guards
count that work (`countCalls`), never time it.

## Canvas

The world is drawn relative to a per-frame origin near the screen (`OriginPen`, `draw.pen`, the
world transform carrying the origin in doubles) and bands only as far as the screen, so the canvas, which keeps points in
float32, never sees the millions of px of a whole history (jagged circles and pills zoomed in otherwise); hit tests stay in world doubles.
A link is hit within 6 px of the line itself (`distanceToCurve` cuts it into pieces of 8 px at most, however long),
in screen px when zoomed out.

## Display options

What the graph draws is the user's: the display options (`GraphViewOptions`, kept with the view's preferences in
`useBranchExplorerPreferences`) open from the button beside the zoom controls (`GraphNavControls`) and from the View
menu's "Display options…" (`openBranchExplorerOptionsDialog`), which lists them as `GRAPH_VIEW_OPTION_GROUPS` does:
branches (their bands, full names or only the last part, `shownBranchName`; one color each or the accent's,
`withBranchColors`), links (branch starts, merges) and changesets (labels, comments, avatars). Each option reaches the
drawing as a `DetailLevel` gate (`detailLevel`), and a hidden thing is also out of the hit tests (`HitOptions`), so
nothing invisible answers the pointer. A cut name keeps its tooltip with the full name.

### Advanced filters & format

The display options' second tab (`ExplorerRulesTab`) holds the advanced rules (`ExplorerRule`), kept per repository
(`useExplorerRules`, `setRules`; `withRules` and `rulesOf` in `model/rulesByRepository.ts`), since a condition names
that repository's branches and owners. The tab's decisions live in `model/ruleList.ts`: the empty state and the
Filters and Formats sections (`ruleTabBody`), the kinds' names (`RULE_KIND_LABELS`), the Add menu (`ADD_RULE_GROUPS`),
how a row reads (its description, with its kind, condition and relatives under it: `ruleRowTitle`, `ruleRowDetail`),
how the list changes, and when an edited rule can be saved (`ruleDraftProblem`). A rule opens in its own dialog
(`editExplorerRule`), stacked on the options.

- **Inclusions and exclusions** keep only the branches an inclusion matches, without those an exclusion matches (an
  exclusion wins), each with the relatives it takes along (`EXPANSION_OPTIONS`: child and parent branches, branches
  merged into them or they were merged into). They reach the graph as `keptByRules` (`branchesKeptByRules`,
  `filterGraph`), apart from the quick filters, and unlike those they can hide the workspace branch: the user wrote
  them. Their order changes nothing.
- **Formats** color the branches, changesets or labels they match with one of `BRANCH_HUES` (`ruleColors`), applied
  in order: a later format colors over an earlier one, so only formats move up and down (`moveRule`). The two
  built-in formats, branches with pending merges and the workspace branch, have no condition.

A condition is a `cm find` condition, as the user writes it. Every enabled rule with one asks the server once per
distinct question (`ruleQueries`: the same condition twice, or the same rules in another order, is one query) through
`matchRules`, one `cm find` each, only while some rule asks one; the tab reads the view's own query (`useRuleMatches`),
so opening it asks nothing more. A condition `cm` refuses fails only its own rule: the row shows `cm`'s error
(`ruleError`) and the other rules still apply. A disabled rule stays in the list and asks nothing; once no rule asks
a question, no earlier answer colors or hides anything (`shownRuleMatches`). A rule's find has no date range or
`limit`, since it must hold for everything the graph may draw; it prints one field per object matched (`matchRules`).

## Loading

While the history is read, the canvas's pane shows the date ruler and a few branches drawn with the graph's own
measurements (`graphSkeletonShapes`, from `canvas/geometry`), pulsing as every skeleton does, beside a blank details
pane: nothing is selected until the graph is in (ARCHITECTURE.md "One layout from the first frame"). With nothing to draw the
panes stay: "No matching branches" where the graph goes when the Branches filter hides every branch, and "No history
in this range" in the details pane (in the graph's while the details are closed).

## Keeping the place

Only the first graph opens on the home badge (else the newest history).
Every later layout (filters, hidden branches, only relevant changesets, new history) keeps one thing where it was
on screen (`keepPlace`, as the official client does): the selection or the home badge while on screen, else the
changeset nearest the middle, else the nearest ancestor still drawn of one on screen (a "+N" node holds its
changesets); with nothing to hold on to, and for "Go to the workspace" when the workspace isn't drawn, the newest
end (`newestEnd`). A running glide (a reveal) is left alone. While the newest changesets are off screen to the
right, a small solid button on the right edge glides back to them.

## Timeline

An overview strip over the graph (`timeline/GraphTimeline`), `TIMELINE_HEIGHT` (68 px) tall above the date ruler, as
wide as the graph's pane. Hidden until the user shows it, then remembered with the view's preferences (`showTimeline`):
the header button beside the details toggle (`TimelineToggleButton`, pressed while it shows), View ▸ Timeline, the
palette and ⌥⌘T (Alt+Shift+T off the Mac, where Ctrl+Alt is AltGr: `graphTimeline`). These are one command,
`branchExplorer.timeline`, registered by every place (`usePlaceCommands`) and in the app's View menu: from another view
it opens the Branch Explorer with the Timeline shown (`timelineToggle`). It slides in only when the user shows it
(`useTimelineSlideIn`); while the history loads, the skeleton keeps its place (`GraphSkeleton`).

It shows only what the graph loaded and draws (the same range and filters), and asks `cm` nothing.

- **The axis is the canvas's** (`timelineAxis`): the whole graph, changesets in column order, squeezed into the strip,
  `TIMELINE_INSET` px in from each end. So the viewport is a frame of its own width wherever it goes (`viewportFrame`).
  A calendar axis was tried and dropped: the frame grew and shrank as it moved.
- **The curve is smooth activity** (`activityCurve`): for each column, the changesets within a window of its time
  (`activityHalfWindow`: ±1 h for a week, ±12 h for three months, ±3.5 days for a year, growing with the range), as a rate
  over the part of the window inside the loaded history (the ends would sink otherwise), a mean per pixel, a Gaussian
  blur (σ 3 px) over the history's own pixels (`historyPixels`), scaled to the 98th percentile. A count per day over the day's columns was
  dropped: flat mesas with cliffs. Under it, in the accent, the share of the user's changesets or the people filter's
  picks (`shareOwners`), never thinner than `SHARE_MIN_HEIGHT` where they have one. A "+N" node's changesets count at
  their own times and in its column (`timelineHistory`, `changesetsInColumns`).
- **The frame** is an accent outline with a light tint and nothing dimmed outside it. Dragging it pans
  (`viewportPannedBy`), dragging an edge zooms the canvas with the other edge fixed (`viewportWithEdgeAt`, within
  `MIN_ZOOM` and `MAX_ZOOM`). Under `FRAME_LINE_BELOW` px it is a line with a handle; edges have handles only from
  `FRAME_EDGES_FROM` px (`frameShape`).
- **Marks** (`timelineMarks`): labels as hairline ticks under the baseline in the label color, those within
  `LABEL_MERGE_DISTANCE` of a tick's first label one slightly taller tick (`labelTicks`); the house on the curve at
  the workspace's changeset (into the curve where it is tallest, its disc under the search ticks and the frame's
  outline over it), with the pending changes' dashed ring at the right end, or pinned at the left with "‹"
  when the workspace is older than the range (`homeMark`, `homeSpots`); /main's newest changeset as a diamond; the
  selected changeset as a pin and the selected branch's lifetime in its hue (`branchLifetime`); search hits as ticks
  along the top, one per pixel (`hitTicks`); more than `GAP_MIN_DAYS` without changesets as a break mark, the longest
  of those closer than `GAP_MARK_SPACING` (`timelineGaps`). Merges into /main have no mark: they repeated the curve.
- **The axis's dates** name days (short ranges) or months where they begin, the first the range's start, those that
  would run into the one before or be cut by the right edge left out, a month in another year than the date before it with its year
  (`axisLabelCandidates`, `spacedAxisLabels`).
- **Pointer** (`timelineTargetAt`, `timelinePress`): a click glides the canvas there and brings the row it lands on into
  view (`viewportAtColumn`, `clickedColumn`: a label tick to its newest label, a gap to where history resumes); press
  and drag scrubs (`viewportForDrag`); after a drag the landed row comes into view (`viewportAfterDrag`). The wheel pans the canvas, with
  ⌘ or Ctrl it zooms (`timelineWheel`). Hovering an empty spot shows a dashed frame where a click would land
  (`ghostFrame`), and every target has a card (`timelineCard`): the hour, day or week under the pointer
  (`bucketSize`) with "N changesets · M yours · K merged to /main" (K: changesets on /main a merge landed on, each once; cherry
  picks and subtractive merges aren't merges into it) and its labels; the frame's dates, zoom and
  changesets on screen; home, gaps, labels and hits their own.

What a frame draws is placed by `timelineDrawing`; `drawTimeline` only paints it. Everything is measured once per layout (`timelineHistory`: each date parsed once, sorted for binary searches,
`sortedSearch`), share and width: never per frame or pointer move. Guards count the searches and parses
(`countCalls`).

## Pending changes

While the workspace has changes under version control (private files alone
don't count), they show as the changeset they will become, as the official client draws its checkout changeset
(`layoutGraph`'s `pending`): a dashed, empty ring counting them, in the column past every changeset on the
workspace's branch (its band reaches it before rows are packed), with the home badge moved to it and a dashed line
back to the loaded changeset, arching over the band when the branch went on without the workspace. Each merge in
progress (merge, cherry pick, subtractive, intervals) is a dotted link into it in its kind's color. They come from
the pending changes already read (`cm status` names a change's merges only in its record's last field, which
`PendingChangesReader` joins as `Merge from 58, Cherrypick from 3 to 7`, read by `mergeLinksOf`), so nothing is asked of the server and the watcher refreshes them;
the history is laid out again only when the pending changeset appears, goes or changes what it draws, never re-read.
Hovering tells what it holds; it is selected like a changeset (its details: the changes, what they are on, the
merges in progress, Open Changes, also Enter and a double-click), and the arrow keys stop at it as the next changeset
of its branch, End as its last (`movedSelection`). "Go home" and the first view go where the home badge is (`homeTarget`): the pending changes, else the
band of a branch without changesets the workspace is on, else the loaded changeset.

## Branch switcher

Groups and orders branches like the official Desktop client (`branchSwitcherGroups`): /main by its
well-known GUID, the workspace's recent branches, then the rest newest first. Recent branches live in the app's settings
(`recentBranchesByWorkspace`, by workspace GUID): every switch puts its branch first (`SettingsStore.rememberRecentBranch`:
five at most, never /main, as the official client keeps them). The first run takes the official client's from its
`plasticgui.conf`, once (`importLegacySettings`, ARCHITECTURE.md "Own config"); the app never writes that file.
