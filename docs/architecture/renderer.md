# Renderer

The renderer's shared conventions: layout from the first frame, data, refresh, navigation, menus, keyboard, focus,
dialogs, the command log and styling. How lists, filters and details panels work is in `lists.md`. The summary
every change respects is in `docs/ARCHITECTURE.md` "Renderer".

```
renderer/src/
  api/          API client, query keys, event hook
  app/          Shell: screens, navigation, command palette, settings, long-running operations
  components/   Domain-aware building blocks shared by features (status badges, path labels)
  features/     One folder per area (pendingChanges, branches, merge, ...)
  lib/          Pure helpers (selection, shortcuts, dates, actions)
  ui/           Design system primitives (buttons, dialogs, menus, tables, toasts)
  styles/       Design tokens and global CSS
```

`lib/` and `ui/` never import from the tiers above them (`api/`, `app/`, `features/`, `components/`; `lib/` not from
`ui/` either): what they need from there is handed to them (`setAvatarPictureSource`) or lives a tier up
(`rendererTiers.test.ts` checks it).

A component decides nothing: what it shows, enables, orders or sizes from data is computed by a pure, tested `.ts`
module beside it, and the `.tsx` only maps the result to JSX (CLAUDE.md "Tests are the quality gate").

- **One layout from the first frame**: a view or page paints its final layout at once and keeps it while it loads,
  when nothing is there and when filters hide everything; only what fills it changes.
  - Its header (title, count, actions, filters, switches) always shows. A filter over what is read waits, disabled,
    until it is read (`useChangeFilter`'s `reading`, History's text); filters that choose what is read (a time range,
    people, the kinds an object list asks for) stay live. A control in a pane's header stays with it (`DiffFrame`: a shelve's actions, a
    review's Comments panel toggle).
  - Loading: the panes stay, with placeholder rows at the real row height under the list's own column titles
    (`ui/Skeleton`, `TableSkeleton`, `FileTreeSkeleton`, `FileTreeList`'s `loading`; a graph's bands, header cards and
    changesets at the graph's own measurements, `GraphSkeleton`), the details as
    `DetailsPanelSkeleton`, a viewer's pane blank. A list whose query hasn't started yet (it waits on the
    repository's name) is loading, never empty: TanStack's `isPending`, not `isLoading`.
  - Nothing there: the list keeps its pane (its count reads 0) and the empty state takes the details pane
    (`changesPanesState`, `objectListState`).
  - Filters hide everything: "No matching …" (`NoMatches`) in the list, under its column titles (`DataTable`'s
    `empty`, `FileTreeList`'s `noMatches`), beside a blank details pane: there is nothing to select.
  - A page whose subject isn't read yet shows its frame, the header a skeleton (`CodeReviewPage`).
  - The one shift left is a banner that says there is something to do, which shows only once that is known
    (Incoming's update bar).
  - Only an error reading the whole view, and an outcome that ends a page (not on a branch, nothing to merge), take
    the whole body. Incoming alone keeps what an earlier read found when reading again fails, and says so quietly in
    its header, the error in the tooltip ("Couldn't check again": `incomingRefreshFailed`); the other views still give
    the body to the error.
  - Every view and page is in the startup bundle (`viewRegistry`, `pageRegistry`), so none paints a fallback it then
    replaces. A heavy library (Pierre, Shiki, three.js, CodeMirror) loads on first use, behind a `lazyComponent` at the
    leaf that uses it (`FileDiffViewer`'s `LoadedFileDiff`, `AnnotationPane`'s `AnnotatedCode`, `FileConflictPanel`'s
    `ConflictBody`, `CodeBlock`'s `HighlightedCodeBlock`, `CommentField`'s `LiveCommentEditor`), whose fallback looks
    as that leaf does while its data loads; it joins `HEAVY_PACKAGES`, and
    `startupBundle.test.ts` fails on a static import that reaches one. The numbers: main-process.md "Start-up", step 4.
- **Effects survive a second mount**: in development React's StrictMode mounts every component, runs its cleanup and
  mounts it again on the same DOM nodes. An effect that owns a resource builds a fresh one on each run and frees it in
  its cleanup, never leaving behind something its next run can't use: `useModelRenderer` gives each renderer a new
  canvas, as disposing one loses its WebGL context for good; `useModelScene` builds its scene in the effect, not in a
  memo. The same holds for a view kept mounted (`KeptView`): its `Activity` runs every clean-up as it hides and the
  effects again as it shows, and detaches its refs meanwhile, so an element a ref puts in state for what's drawn into
  it is kept with `useKeptElement` (`elementsKeptWhileHidden.test.ts`). The production build runs each effect once and hides such a bug, so `npm run e2e` runs the smoke test over a
  development build too (scripts/e2e/README.md). An effect returns a clean-up or nothing: an arrow that returns what
  a DOM call gives can hand React a promise (`scrollIntoView` returns one in the Chromium the app runs), which crashes
  the window as the effect runs again (`effectsReturnCleanUps.test.ts`).

- **Data**: TanStack Query. Every workspace query key starts with `queryKeys.inWorkspace(path, ...)` (a place's, `queryKeys.inPlace`: ARCHITECTURE.md "Places"), so `invalidateWorkspace(path)` refreshes everything after an operation
  (or what it can touch: `invalidateWorkspace(path, affected)`, `runOperation({ affects })`).
  A page opened from a list starts from the row that list already read, so it shows at once: a shelve
  (`cachedShelve`), a code review (`listedReview`, as `initialData` as fresh as that list, never from a list an
  operation marked stale).
- **Refresh**: views refresh themselves when something changes, never on a timer except the incoming check (the app's
  own update check runs hourly too, against GitHub, never the server: features/updates.md).
  - `main/watch/WorkspaceWatcher` watches an open workspace (recursive on macOS/Windows; on Linux a watch per folder,
    `FolderTreeWatch`, as Node's recursive mode there watches every file and loses files saved by replacing them;
    it walks the tree asynchronously, `FOLDERS_PER_STEP` folders at a time, so a big project never holds the main
    process, and `workspaces.watch` answers once every walk under way is done (the windows take the workspace as
    partly watched until then); once its first walks have watched every folder, the watch reports a file edit
    anywhere once, for the edits made in folders not yet watched (`ANY_FILE_EDIT`);
    an event Windows sends without a name, when a burst overflowed its buffer, refreshes everything),
    skips `ignore.conf` folders (on Linux the folders watched follow its edits, `followSkipRule`) and `.plastic` lock/temp files, coalesces bursts (300 ms quiet, 2 s max wait) and drops what the
    app's own writes cause (`changesWorkspace` commands and tracked operations): the renderer refreshes after those anyway.
    `cm status --changelists` writes the changelist files back on every read, so those rewrites count as its own too (`rewritesChangelists`).
    A watch that sees only part of the workspace re-reads the local views on screen on every focus instead, however fresh (`localQueryDefaults`), from the
    start ("Some folders here aren't watched") or once a watch breaks later (`workspaceWatchBroken`: one error toast per
    workspace and session, `noteBrokenWatch`; no polling).
  - `workspaceChanged` tells file edits (pending changes, review marks, files view, open diffs of workspace files; if auto refresh is on, and once when it's turned back on)
    from `.plastic` rewrites by any tool (workspace info; everything when the loaded changeset or branch moved). See
    `app/shell/useWorkspaceWatcher.ts` and `app/refresh/`. A diff with unsaved edits holds still and offers to reload instead.
    A hidden window (minimized, covered, on another desktop) keeps the changes and refreshes once, when it shows again.
    File edits name the folders they touched (up to `MAX_CHANGED_FOLDERS`, else anywhere): the files view re-reads only
    those listings and the ones above them (`isAffectedByFileChangesIn`), not every open folder.
  - Locks live on the server, where nothing reports changes: the lock marks of pending changes read them as they show and
    on focus, at most every 30 s (`LOCKS_STALE_MS`); the watcher's refresh of the changes doesn't read them again.
  - Window focus (wired to real focus in `trackWindowFocus`) refetches stale server views. Local views skip it while
    the watcher sees everything with auto refresh on, and otherwise are re-read on every focus (`localQueryDefaults`).
  - Incoming: `useIncomingSummary` polls every minute with focus, every five minutes behind other apps, never hidden, and on focus if
    older than 20 s. A branch head moved by someone else refreshes the repository views (`isAffectedByNewChangesets`).
  - Refresh, asked for (⌘R, the menu's, a view's `ViewRefreshButton`), reads again what the window shows, or only what
    the page in front shows when it says (`refreshShown`, `pageRefreshScope`: a code review's, features/code-reviews.md
    "The review's page"). A page window has its own Refresh (`refreshCommand`).
  - Use `refreshQueries` for event-driven refreshes: it never cancels a fetch in flight, it queues one follow-up.
- **Mutations**: `runOperation` (progress card, cancel, refresh) for long operations; `runAction` for quick ones. Both report errors as toasts.
  An update or a switch runs alone on its workspace: it waits for any other operation, and the others wait for it (`blockingOperation`).
- **Top bar**: one bar across the window on every screen (`app/shell/TopBar`), the sidebar under it: the window's
  buttons, the home button (`HomeButton`), then what the screen adds. A workspace adds a breadcrumb, outer to inner:
  the workspace (`WorkspacePill`: its repository's avatar, name and kind chip, the repository under them; it opens
  the switcher, and a right-click its menu, `currentWorkspaceMenu`), a chevron, its branch pill and incoming chip;
  then the search and the account at the end (`WorkspaceTopBar`). A repository opened without a workspace shows
  itself in the same place (`RepositoryPill`, `RepositoryTopBar`). The home screen adds nothing. The bar is 52px
  tall (`TITLE_BAR_HEIGHT`, `--topbar-height`, which `tokens.test.ts` keeps equal) and its pills 40px
  (`--topbar-control-height`), 6px clear of its edges, their two lines with no gap between them: 36px pills in a 44px
  bar read cramped and small, and a 56px bar looked heavier than other apps'. The search and a repository's Create
  workspace keep the standard 28px (`--control-height`): at 40px the search read as one more card. The macOS traffic
  lights are centered on the bar as macOS draws them, about 14 points tall (`trafficLightsAt`). The workspace comes
  before the branch because the branch belongs to it, the order the official client shows; a workspace card in
  the sidebar, under the branch, read backwards. In a window 1100px wide or less the workspace pill shrinks to
  its avatar (`PlacePill.module.css`), its tooltip saying the rest and, below, the workspace's folder
  (`workspacePillTip`), so the branch keeps the room. Sidebars (`ui/nav/SidebarNav`) have no title band of their
  own, nor a workspace card.
  - While the workspace's info loads, the pills show what the home screen already read of it (`workspacePreview`:
    its name, repository and branch, from the cache, never asking `cm`), so opening a workspace from the home screen
    shows them whole at once; what isn't known yet, and the branch's comment while it loads
    (`workingObjectCommentLine`), is a placeholder bar as tall as its line (`SkeletonLine`), so the pills don't
    change height or jump when it arrives. A window opened straight into a workspace (the app's start) shows
    placeholders until its info is read. A partial or dynamic workspace's kind chip comes only with the info, which
    widens its pill then. The home screen's account switcher shares the pills' look (`ToolbarControl`) but keeps
    its own 36px, set by the sidebar's rows.
  - Home is one click (or ⇧⌘H, `app.home`, File ▸ Home) from anywhere: in a workspace it leaves for the home
    screen, on the home screen it goes back to its welcome (`WELCOME`), where the house is lit. It sits in the top
    bar, not the sidebar, so it stays put whether the sidebar is folded or not and costs no sidebar entry. It is a
    borderless icon button, the bar's 8px gap on each side and nothing between it and the first pill: a separator
    there, or a bordered square like the pill's, both looked off balance. It replaced the app's mark and name, which
    opened About: the welcome shows those, and the status bar's version opens About.
  - The way back: on the home screen, after the house, "‹ <workspace>" returns to the workspace the window left
    (`leftWorkspacePath`, `BackToWorkspaceButton`) on the view and pages it showed (`returnToWorkspace`: the
    navigation stays while on the home screen), as do Back (⌘[, Alt+←) and the mouse's back button. It shows only
    while `cm` lists that workspace (`workspaceToReturnTo`, from the list the home screen reads anyway).
- **Navigation**: a view per sidebar entry (`app/navigation/viewRegistry.ts`) and a stack of drill-down pages (`app/navigation/pages.ts`) such as history, diff or merge.
  Back closes the top page, except a merge in progress, which only steps aside (merge.md "A merge in progress"): it
  stays mounted, its keys quiet while it doesn't show (`PageShownContext`).
  - **Views keep their place**: each view keeps the pages it was left with (`KeptViews`, `switchedViews`). The
    sidebar, ⌘1… and the palette's Go to return to a view as it was left (`navigation.returnToView`), and to its list
    when it is the view shown. Every other way into a view (a link, "View changes", "Show in Locks", a toast) shows its
    list, closing the pages it was left with (`navigation.goToView`): it goes there to show something in the list. A
    page window asks its workspace window for one or the other (`viewCommandId`, `viewListCommandId`); a view its
    place doesn't show gives the place's first (`viewShownIn`). Another place
    opening while unsaved edits are asked about keeps nothing of the place left.
    Leaving a view still settles unsaved edits first (`afterLeaving`), so a view set aside never holds any. A merge in
    progress belongs to no view: a view keeps only the pages under it. Another place opening forgets them all; the
    home screen between two visits of one place doesn't.
  - **The latest views stay mounted**: the view shown and the last ones shown, up to `MOUNTED_VIEWS` (3), are mounted
    with their top page, each in an `Activity` (`PlaceLayout`, `KeptView`), in the sidebar's order so none moves.
    Hidden, a view keeps its DOM and React state (a list's scroll and filter, a review's tab, its picked thread, what
    was typed) while its effects stop: no shortcut, watcher or query observer runs, so it asks `cm` nothing. Shown
    again, it reads what went stale as a view mounted anew would, and nothing else. Hidden, its queries have no
    observer, so past their `gcTime` (five minutes) or the bound on unused ones (`boundUnusedQueries`) they're
    dropped: a view shown again after that reads them anew, showing as loading, its own state (tab, selection, typed
    text) kept. Effects that scroll to a value run for new values only (`useNewValuesEffect`), never because the
    view shows again; a row asked for again is a new request (`RowReveal`, `revealAsked`, `DataTable`'s
    `revealCount`: Go to file on the file selected), and a table shows a selection set while it was hidden, the row
    already selected too (`selectionSetWhileHidden`, as `selectInView` sets one: Show in Locks). A view past them unmounts and comes back from its pages alone. What's kept hidden is in the DOM: code looks elements up within itself, never by
    a document-wide id (a review's conversation, `elementById`), and checks what shows (`checkVisibility`, as
    `focusMain` does).
  A sidebar entry may show a count (`useBadge`) and a dot for something waiting there (`useDot`), whose words go under
  the entry's tooltip and in its accessible description: Changes' says what changes were left and where
  (`leftChangesSummary`, in the "Welcome back" banner's words).
  Folded (`toggleSidebar`, and always in a window under 1000px unless opened by hand: `useSidebarCollapsed`), the
  sidebar is a rail of tiles (`useInRail`), the home screen's too: each entry's icon over its label in `--text-xs`,
  two lines at most, balanced, a word too long cut with an ellipsis (an organization's name), or a short `railLabel`
  ("Expand", "All", "Local"); the selected tile as wide, its icon in the accent. The rail is 80px (`--rail-width`), so
  the longest one-word labels ("Changesets") fit on one line in every OS's font; labels wrap at the folded width from the start of the fold, so nothing jumps as it ends. The count is pinned in
  the accent over the icon's corner (99+ at most, `navBadgeText`), the dot at the tile's own corner. Tooltips only add
  what the entry doesn't show (`navItemTip`): the shortcut and the dot's words, and on a tile the whole count, the
  detail and a shortened label spelled out.
  The sidebar never scrolls, which the rail couldn't show: its groups show the entries that fit and a More entry after
  them (`NavGroups`, `shownItemCount`), whose popover lists the rest under their groups' titles; More looks selected
  while it holds the view on screen. It measures the entries as laid out (a tile's label may take two lines) whenever
  the sidebar's size or entries change, the ones in More kept laid out out of sight for that.
  There is no Annotate page: "Annotate" outside the Files view opens the file's history annotated (`annotatedHistory`).
- **Actions**: menus and the command palette share the `Action`/`MenuEntry` model (`lib/actions.ts`). Register palette commands (and their shortcuts) with `useCommands`.
- **Prefixes**: one vocabulary for what a prefix names, wherever it's typed (`KIND_PREFIXES`, `lib/kindPrefixes.ts`):
  `cm`'s own specs `cs:` `br:` `lb:` `sh:`, `cr:` for a code review, and `@` for a person. In the command palette each
  narrows the search to its section (`SCOPE_PREFIXES`, `parseScope`), beside the palette's own `>` commands and `/`
  files; in a comment each opens its suggestions (`SUGGESTION_TRIGGERS`, docs/features/rich-comments.md), beside the
  editor's own `:` emoji and `#` issues. A surface adds prefixes of its own, never another meaning for a shared one
  (`sharedPrefixes.test.ts`). A prefix counts only at the start of the palette's text, lower case as `cm` writes it; a
  changeset's number (`1234`, `cs:1234`) is still found in any search, and a number after `sh:` or `cr:` names that
  shelve or review, first and as a full match (`namedFirst`): with its row when the lists read hold it, else by its
  number alone (`exactShelveResult`, `exactCodeReviewResult`, as `exactChangesetResult`), read only once picked.
  A number alone (`1234`, `typedObjectNumber`) names a shelve or code review too, only once it is known to exist,
  never as a row that opens to an error: a shelve the recent shelves read hold, a review the newest reviews read hold
  or, once typing pauses, one `cm find review "where id = N"` found (`reviewNumberToLookUp`,
  `ServerMatches.reviewNumbered`; a changeset's number costs it too, as nothing read rules a review out; after `cr:`
  the number alone shows until it answers none; no lookup for shelves, whose numbers nearly all exist and overlap the
  changesets').
  The changeset comes first, unless the number is past the newest changeset read
  (`UNLIKELY_CHANGESET_QUALITY`): review numbers are object ids, far past every changeset's on a large repository. `#` is
  the editor's, for issues (docs/features/issue-trackers.md "Suggesting issues"); the palette doesn't read it. Under the search, a chip per prefix that works where
  the palette is open (`offeredPrefixes`, `scopeChipsFor`), each showing its prefix: All and the sections searched most
  in a row, the rest under More, which takes the name of the one picked. A chip writes its prefix in place of the one
  typed, the rest as typed (`queryInScope`), so the text stays the only state and a chip teaches what to type;
  clicking the chip picked goes back to All (`clickedChip`). ⌥⌘← ⌥⌘→ step through them, Alt+← Alt+→ off Mac
  (`scopeStepOf`, `steppedChip`): arrows any keyboard layout has, as a browser's tabs, never ⌘ or ⌥ alone, which move
  the caret. The home screen, which searches only commands, has none. Labels, code reviews and people are
  listed only when asked for (`lb:`, `cr:`, `@`). People are the owners of the lists the palette already reads and
  everyone the views showed (`palettePeople`, `peopleSeenIn`), no command of their own, ranked as a mention's
  suggestions (`indexPeople`); picking one opens the Changesets view on their changesets on every branch, in the time
  range it remembers (`showPersonChangesets`, the people filter's `onlyPerson`).
- **Long menus scroll** within the room the window leaves them (`ui/menu/Menu.module.css`: Radix measures it), never
  running off-screen: a picker of many tools, a long "Open with ▸".
- **Menus**: one grammar for every object's menu (`lib/menuGroups`): the default action (what Enter does in the app:
  open the workspace, a diff), every way to open it in other apps (the editor, the terminal, "Open with ▸", Reveal:
  `openOnDiskEntries`, docs/features/open-with.md; a file's Enter is its "Open in <editor>"), what it does (switch, apply, check out), merges, what it creates, where it leads (history,
  annotate, browse, a branch's changesets, Show in Branch Explorer), the OS and the user's programs (save a revision, "Tools ▸": docs/features/tools.md), the clipboard (Cut, one "Copy ▸", Paste), edits (rename, comments,
  hiding, permissions), and what undoes or deletes it last, in the danger tone; a separator between groups. Entries come from one
  vocabulary (`components/menuWords`: one id, icon, wording and group per concept) and `groupedMenu` orders them.
  One builder per kind (`branchMenu`, `changesetMenu`, `labelMenu`, `shelveMenu`, `codeReviewMenu`, `fileMenu`,
  `pendingChangeMenu`) serves every host the object shows in (`MenuHost`): its view, details' "More actions", the Branch Explorer,
  the top bar's pill (right-click, `workingObjectMenu`), the switcher, the palette. A host only adds entries, at the
  end of their group (`withEntries`: the graph's "Go to head changeset"); the Branch Explorer leaves out "Show in
  Branch Explorer". One exception: the palette's code reviews of a branch have no "Switch to this branch", as its
  searches read reviews without branch names (`listSummaries`; naming them would read every branch,
  `BranchNamesCache`), while changeset and shelve reviews come named (`CodeReviewSummary.target`) and keep it. "Copy ▸" (`copySubmenu`) lists what the object has in one order (name or number, title, paths,
  its link, spec, full spec with `@repository`, comment, GUID), each with what it copies, and the toast names it ("Branch spec
  copied"); ⌘C in a list copies its first entry (`useCopyCommand`) unless text is selected, ⇧⌘C a link to what is in
  front (`useCopyLinkCommand`, features/deep-links.md). A menu names a list key (⌘D, ⌘C, ⇧⌘C) only where its list binds
  it: a list on a page that binds none, its keys reaching the view under the page or the page's own object, passes
  `MenuHost.listKeysElsewhere` (a branch diff's list of changesets). Items that open a dialog
  end with "…"; submenus hold real sets of choices, the choice made checked after its label (`checked`), so the icon
  in front stays the item's own (an app's). `menuGrammar.test.ts` checks every builder and every host, in a workspace and in a repository with none. A menu's
  content is in a portal, but React bubbles its events to the row its trigger sits in: `ActionDropdownMenu` keeps its
  clicks and mouse presses from reaching that row (picking from a changelist's "…" selected and folded it).
- **Going to a thing**: navigating to a thread or comment in a code review's conversation (`placeInView`) places its top
  a fifth down the viewport, even when it was already on screen and however tall it is, so it reads with what follows
  it; the top and the bottom of the scroll range stop it short (`placedScrollTop` in `lib/scrollPlacement.ts`). Not
  `focusScrollTop`, which bottom-aligns a card taller than two-thirds of the viewport, right for a comment shown in its
  context, not for going to it.
- **Back buttons**: a page goes back with the mouse's back button and, on Windows, the Browser Back key (the `app-command`
  the main process forwards as `navigateBack`), once per press however it arrives (`useBackButtons`).
- **Keyboard**: every shortcut is declared in `shared/shortcuts/shortcutRegistry.ts` and bound through `hotkey(id)`, which
  reads the window's keymap, a person's own keys included (docs/features/keyboard-shortcuts.md); the shortcuts sheet
  (`?`, ⌘/) lists it, the native menus show it (`menuAccelerator`), and a test rejects shortcut literals anywhere else. Views
  get ⌘1… in sidebar order (`viewShortcut`; past the ninth ⌥⌘1… on macOS, whose ⇧⌘3–5 take screenshots). Window
  shortcuts and menu commands run once per press and wait while a modal dialog is open (`lib/modalDialog`); the one
  exception is a diff shown in a dialog, whose step keys reach it, not the diff behind (`keysReach`, its dialog marked
  `STEP_FRAME`: docs/features/code-reviews.md "See in context").
  Whatever keeps a view mounted but hidden wraps it in `ViewShownContext` set to false: the place's view under a page
  (`PlaceLayout`, `viewLayerShown`), a merge set aside (`PlaceLayout`, `showsMerge`; its own controls also read
  `PageShownContext`), a review's tab not picked (`CodeReviewPage`, `reviewTabShown`). Meanwhile
  `useShortcut` listens to none of the keys inside it, so ⌘↩ under a merge page doesn't check in too. It covers
  `useShortcut` only: commands registered with `useCommands` run from `CommandShortcuts` whatever is shown. The
  window's own keys (Back, the app's commands and menu) are outside every hidden layer.
  `mod` is ⌘ on macOS and Ctrl elsewhere, shown as symbols in the Mac's order (⇧⌘K) or spelled out (Ctrl+Shift+K,
  `formatShortcut`). A shortcut takes other keys off macOS where Windows and Linux conventions differ (`keysOffMac`: Alt+←
  back, Delete deletes) and never Ctrl+Alt there, which is AltGr on European layouts (the test checks it). Letters match
  by the character typed (Ctrl+Z on a German keyboard), digits by position. A comment field takes its formatting keys
  (⌘B, ⇧⌘U, ⇧⌘C: the registry's Comments area, `scope: 'commentField'`) before the window's shortcuts, inside a focused
  comment field only (`yieldsToCommentField`; features/rich-comments.md "Writing"). F2
  renames the selected file, branch, label or attribute (`useRenameCommand`); the context-menu key and Shift+F10 open a list's menu at its focused row. A list driven from its filter field (the palette, Go to file, the branch and workspace switchers) offers a result's actions three ways that open one menu, at the "…" (`RowActionsButton`) the highlighted row shows: that button, Tab (or the menu key, `isRowMenuKey`) and a right click on any row, which highlights it first; closing the menu gives focus back to the filter (the test: `rowActionsEverywhere.test.ts`). A field (`isTextEntry`) keeps
  its own text chords, Ctrl+Y (redo) included off macOS (`belongsToField`).
- **Per OS**: platform differences go through small pure helpers taking the platform (`revealLabel`, `trashName`,
  `windowChrome`, `appMenuTemplate`, `formatShortcut`), read once in `lib/platform.ts`. Windows draw their title bar per
  `windowChrome`: macOS insets its traffic lights over the top bar's start; Windows hides its title bar and overlays
  its caption buttons on the top bar's end (`titleBarOverlay`, clear, symbols in the theme's text color; the page keeps
  `--caption-buttons-width` free), with a menu button at the bar's start (and Alt or F10) popping up the menu bar's menus;
  Linux keeps the desktop's frame and menu bar. Native parts follow the app's theme (`followAppTheme`) and the page's
  zoom (View > Zoom In, Zoom Out). The app keeps one zoom, saved (`zoomLevel`): every window opens at it and keeps it
  as its own (`WINDOW_ZOOM_MODE`, `isolated`), and the menu's own items (`zoomPage`, not Electron's zoom roles, which
  tell nobody) set it on every window. Not Chromium's default mode, which keys a zoom by the page's whole `file://`
  address, query included: dropping the query (`openPlaceFromAddress`) would change a window's zoom without telling
  anyone, and a zoom would come back at a launch only at the same address. The menu's items, each page load (`followPageZoom`) and showing a window
  (`fitWindowControls`, before `show()`) center the traffic lights in the scaled top bar (`trafficLightsAt`) and make
  the caption buttons as tall as it (`fitCaptionButtons`). The page starts at the zoom its address names
  (`startingZoomIn`; the preload's `webFrame.getZoomFactor` may not have it yet as the page loads) and hears it again
  as it loads and at each change (`pageZoomChanged`): `--window-zoom` keeps 84 window points of the top bar free for
  the traffic lights at any zoom. The menus
  (`main/window/appMenuTemplate`) have an app menu on macOS only; elsewhere File ends with Settings and Exit (Windows)
  or Quit (Linux), Help with Check for Updates and About, and `&` marks each item's Alt letter. The menus hold what
  a person looks for there: windows and workspaces (File), the branch work (Branch: switch, new, merges), the palette,
  the command log and the sidebar (View), the documentation, the shortcuts, reporting an issue and the log files to
  attach to it (Help); what the screen already offers in place (updating the workspace: the incoming chip) stays out.
- **Focus**: the list, tree or graph a view or page works on carries `MAIN_FOCUS` (`lib/mainFocus.ts`). `useMainFocus`
  focuses it after navigating and whenever focus falls to the document (a dialog, menu or popover closed), and hands it
  list keys pressed while nothing has focus. A closing menu gives focus back to its trigger unless its action opened
  a dialog or put the caret in a field ("Check in this changelist": the comment), which keep it (`focusAfterMenu`;
  the action runs first, `runAfterMenuCloses`). A dialog holding the trigger was open before the menu and doesn't
  count: a result's menu in Go to file gives focus back to its filter. Views keep their list's selection while away (`useViewSelection`).
  Lists expose ARIA roles (grid, tree, listbox) with `aria-activedescendant` on the focused container. The keyboard
  ring is for focus the keyboard moved (`showsFocusRing`, `lib/focusRing.ts`): Chromium rings any focus a script moves
  once a key was pressed (and before any input at all), and a clicked button at the next key, so focus the app moves on
  its own (a workspace or repository opening on its first list, which rings at the first key aimed at it as a list
  reached by a click does: `mainFocusMover`, `ringsAtKey`; Expand Diff giving the code the keyboard: `focusMain`'s
  `mover`) or a click leaves (the change arrows: `settleClickFocus`) goes through
  `focusAs`, `focus({ focusVisible: false })`, which keeps it ringless until a Tab (Go to line… too). New code uses
  `focusAs` and `settleClickFocus`. Two older marks remain for what they alone can see: a click inside the code, whose
  focus may land in Pierre's shadow root (`usePointerFocusMark`, `data-pointer-focus`, which the code panes' rings
  skip), and focus a closing menu hands back to its trigger (`trackPointerReturnFocus`, `data-pointer-return-focus`).
- **Dialogs**: `openDialog`/`askDialog`, `confirm`, `prompt` — callable from anywhere, no local state plumbing.
  A popover opened inside a dialog goes through `ui/Popover` (or `FilterPopover`), which is modal there
  (`InsideDialog`, `useInsideDialog`, set by `Dialog` and `CardDialog`): the dialog's scroll lock takes the mouse
  wheel from anything outside it, a portaled popover included, and only a lock of the popover's own gives its list the
  wheel back. Modal, the popover's first click outside only closes it. A raw Radix popover in a dialog doesn't scroll.
- **Buttons that create something** ("New branch", "New label", "New workspace") show what they create with a plus:
  Lucide's `GitBranchPlus`, `TagPlus`, `MessageSquarePlus`, `DatabasePlus`, `FolderPlus`, never the bare `Plus`, which
  only says "add". Where Lucide has no such icon the feature draws one on its grid (`TagsPlus`, `Tags` with a
  plus). An empty state's "New …" button shows it too, and the menu entry and palette command that make the same
  thing show the same icon (`newLabel`, `newCodeReview` in `menuWords`). The test reads each `<Button>` with a
  written "New …" label and wants an icon whose name ends in `Plus` (`newButtonsShowTheirObject.test.ts`).
- **Command log**: under the view past a `SplitPane` splitter, as tall as it was left (`COMMAND_LOG_HEIGHT`,
  remembered across sessions), the view keeping 200px. Its filter (⌘F or / from the log; "Failed" for failures only)
  is a list filter like any other (`commandLogFilterTexts`), kept for the session; each command is numbered by its
  place in the log since it was cleared (`NumberedLog`), so numbers stay put as the scope, the filter and the
  500-entry cap drop rows. A failed command shows how it ended ("Exit code 1", or "Stopped" without one) above its
  output. An issue tracker's requests show among the commands (`source: 'tracker'`: method, host and path, a failure
  as "HTTP 404" or "No answer", `entryEnding`; docs/features/issue-trackers.md "The HTTP client"). Each command line
  is colored by its parts (`commandLineTokens`, `--syntax-*` tokens): `cm` quiet, the command and its subcommand
  (`lock list`, `find branch`) in one color, option names in another (each kept whole on its line), `--format`'s
  `{fields}` apart from its separators, and a `cm find` query's keywords, operators, strings and numbers; the line
  is read by its words' shapes, as the log joins arguments unquoted, and a failed command's name turns red.
  Shiki was passed over: no grammar knows `cm`, and a shell grammar colors a find query as plain words.
  A long run of one field's ORed conditions (a block of branches' reviews: up to 50 `targetid`s) shows folded to
  its first and last, behind a "…48 more…" button that shows it whole and folds it back (`foldedCommandLine`,
  `FoldableCommandLine`); Copy takes the whole line, and the filter searches it.
  Revealing a command the filter or scope hides clears them. Its header shows the `cm` version the app runs
  (`cmVersionQuery`, already read at start).
- **Styling**: CSS modules using the tokens in `styles/tokens.css`. No raw colors in styles or components
  (`styles/noRawColors.test.ts`, which lists the few colors written out on purpose); optional classes join with
  `classNames`.
  - Text tokens keep 4.5:1 and focus rings 3:1 (`styles/tokens.test.ts`); avatars' white initials 4.5:1 on every
    `--avatar-*` fill (one per `stableHue` hue, all weighing alike, `avatarColorOf`: people, workspaces and
    repositories alike), and server monograms' letters, a tint as secondary
    marks (`--tint-*`), 3:1 as status letters do. Branch headers set their text's lightness per hue to a contrast on
    their tint (`--branch-name-contrast`, `--branch-comment-contrast`, `hslAtContrast`), so the comment always reads
    quieter than the name, pale yellows as much as dark blues. Focus shows with `--focus-ring-visible`, or
    `--focus-ring-inset` on rows and panes (over their content when it would paint over the ring); filled controls
    draw `--focus-outline` 2px out, and state rules with a shadow of their own restore the ring (`focusRings.test.ts`).
  - A translucent state tint (pressed, selected) on a control floating over content lies over `--bg-surface-raised`
    (`linear-gradient(tint, tint) var(--bg-surface-raised)`), so the picture or model behind never shows through it
    (`StageControls.module.css`).
  - Overlays lie over the whole window, whatever the page around them. One drawn in the page (a comment's larger
    editor, `CommentFocusGroup`) draws its backdrop beside its panel, never portaled apart: one parent keeps them in
    one stacking context (`focusModeSurfaces.test.ts`). The boxes every view sits in (`PlaceLayout`, `SignInCover`,
    `PageFrame`, `SplitPane`, `Stowable`, `PageWindowScreen`) make no stacking context and no frame for fixed boxes: no
    `isolation`, `z-index`, `opacity`, `transform`, `filter`, `contain` or `will-change` on them
    (`viewWrappersMakeNoStackingContext.test.ts`, which names the one allowed: `SignInCover`'s while it covers). One there
    put every larger editor outside a dialog under its own backdrop; `npm run e2e` checks the panel is what a press at
    its middle reaches.
  - Every box a view or page sits in that grows to fill the window (`flex: 1`) lets its content be smaller than
    it is: `min-width: 0` and `min-height: 0`, or an `overflow` that clips (`viewWrappersFitTheWindow.test.ts`; the
    boxes are listed once, `VIEW_WRAPPERS` in `testing/viewWrappers.ts`). A flex item is otherwise as large as its
    content along its parent's direction, and a box can't tell which way its parent lays out, so the rule asks for
    both: `PageFrame` without `min-height: 0`, in the column `.layer` a merge in progress stays mounted in, let a long
    merge grow past the window, and neither its list nor its diff scrolled.
  - Motion uses the `--duration-*` and `--ease-*` tokens and the shared keyframes of `styles/global.css` (through
    `--keyframes-*`); reduced motion zeroes the durations, so only loops (spinners, skeleton pulses) opt out themselves.
    A stagger's delays are made of a duration token too (`ui/AvatarStack`'s), so reduced motion zeroes them as well.
  - Several people in little room are one `ui/AvatarStack`: overlapping at rest, spreading on hover over what follows
    (it keeps its resting width), each avatar with its own tooltip and an optional corner badge (a reviewer's status),
    shown only spread; its `label` is for screen readers only, never a tooltip of the whole. Its geometry is
    `avatarStackLayout`. What the spread covers steps aside while it does: the people filter's label fades out.
  - Lists that load show skeletons at their real row height (`ui/Skeleton`, `TableSkeleton`, `ListWithDetailsSkeleton`),
    inside the layout they will fill ("One layout from the first frame").
