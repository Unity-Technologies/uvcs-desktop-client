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

"Apply these rules" turns a repository's rules off without losing them (`setRulesOn`, and `isOnIn` and `withOnIn` in
`model/offByRepository.ts`): while off, the graph applies none (`useAppliedExplorerRules`), so nothing is hidden or
colored and no rule asks the server anything, and the tab dims them until they're turned back on. With no rule, the tab shows
no switch, so adding the first one turns the rules on (`addingTurnsRulesOn`).

### Changeset colors

The display options' third tab (`ChangesetColorsTab`) gives each person picked a color their changesets take
(`UserColors`, `model/userColors.ts`). People keep their color in every repository, so the list is the view's, not a
repository's. "Add people" offers whoever made a changeset in the loaded history (`historyAuthors`) and has no color
yet, by name (`usersToAdd`); each one added takes the first of `BRANCH_HUES` no one has (`withUsersAdded`). A
changeset's color is its format rule's, else its author's, else its branch's: the authors' colors go under the rules'
(`changesetUserHues`, `withUserColors`). "Color changesets by who made them" turns them off in the window's repository
alone and keeps the list, as "Apply these rules" does (`setUserColorsOn`, `useAppliedUserColors`). With no one colored,
the tab shows no switch, so adding the first person turns the colors on there (`addingTurnsColorsOn`). The tab reads
the view's own history query, so opening it asks the server nothing.

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
