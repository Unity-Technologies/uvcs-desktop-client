# Shelves and switching

How pending changes survive switches, updates and shelving, and how two people share a branch
(`main/workspace`, `features/leftChanges`, `features/shelves`, `app/shell/workspaceOperations.ts`).

## Switching with pending changes

`cm switch` only ever runs on a clean workspace (`main/workspace/switchWithChanges.ts`), whatever client.conf's
`PendingChangesOnSwitchAction` says. The renderer's single entry point is `switchWorkspace`
(`app/shell/workspaceOperations.ts`): preflight, then ask (or follow the setting) whether to leave the changes or
bring them along. The main process shelves them with the official automatic-shelve comment, checks the shelve holds
them all, records it in the settings (`switchShelves`), undoes, moves added files aside (until the shelve brings them
back), switches, and merges the shelve on the target (bring). Failures put the changes back, switching back first if
the switch moved the workspace halfway. Left shelves (the app's and the official
client's) are offered again by the "Welcome back" banner in Changes (`features/leftChanges`), or restored
automatically on arrival when they apply cleanly. Changes still waiting to be brought (conflicts left for the merge
view) are offered on the target, and as left ones on the source if the user goes back instead.

## A workspace on a shelve

`cm` keeps shelves as changesets numbered below zero: a workspace switched to shelve 3 reports changeset -3 in
`cm status`, and `cm ls` lists its revisions as changeset -3 on branch `id:-1`. The app reads that as no changeset
(`WorkspaceInfo.loadedChangeset: null`, the selector naming the shelve; `TreeItem.changeset: null` with `shelveId`), and
any other number below zero as unexpected output (`loadedChangesetOf`), so no query ever starts from one. Nothing
comes in (`NothingIncoming`, no server query), the status bar shows the shelve and no changeset, the Branch Explorer
no home or pending changeset, Files names the shelve as the last change (no Annotate: `cm annotate` can't read a
shelve's revisions), and a new branch starts from /main only. `cm` checks nothing out there ("No checkout branch
found"), so the workspace takes no changes or merges.

## Shelves in Changes

Changes put aside, whoever put them there, are in one place: "N shelves" in the Changes header (`MyShelvesButton`,
⇧⌘S, "Your shelves…" in the palette), shown while the user has shelves in this repository from the last three months.

- **Shelving** (the check-in panel's Shelve mode) undoes what it shelves: `shelveAndUndo` (`main/workspace`) is the
  switch flow's first half. It shelves with the user's comment, checks the shelve holds every change (`createVerifiedShelve`),
  records it as a switch shelve record with `reason: 'shelve'`, undoes the changes and moves the files they added aside;
  a failure puts them back. The toast offers Undo (apply and delete). "Keep the changes here", under the comment, is the
  other way (a plain `cm shelveset create`), asked for each time: the panel goes back to checking in after a shelve.
  The panel's shelve (`shelveFromPanel`) takes the files as they are on disk, as its check-in does
  (`checkinFromPanel`); shelved away, the changes take the draft comment along, kept here they leave it for their
  check-in.
- **The list** is one `cm find shelve` by owner and date (`useMyShelves`, `SLOW_CHANGING_QUERY`), refreshed by shelve
  operations; the count comes from it. Typing filters it, and after three letters one bounded server search by comment
  (`useShelvesSearch`, `shelvesScope`) finds older ones. A row opens the shelve's diff, which shows its comment and Apply as the page's
  primary action (`ShelveDiffActions`; only for a shelve a list already read). Apply is on the row; Apply and delete,
  code review, copy and delete are behind "More actions".
- **Everyone's** shelves are the other side of "Mine | Everyone" at the top (a radio group: Tab reaches it, ← → switch;
  ⇧⌘S again in the list; "Everyone's shelves…" in the palette). Every opening starts on Mine, which the button counts,
  and reads nothing more until Everyone is picked: then one `cm find shelve` by the same date alone
  (`useEveryonesShelves`; on codice@cloud 128 shelves in three months, 0.1 s, 60 KB), cached and refreshed like Mine's.
  `cm` can't sort shelves and `limit` keeps the oldest, so dates bound these queries, not limits: the list renders the
  newest 200 ("Newest 200 of N · filter to find others"), and the server search of everyone's goes back a year
  (limit 100 as a ceiling, "More may match" when reached). Rows name the author with their avatar ("You" for the
  user's own), and the filter matches authors in what is listed: `cm` matches owners only whole. Someone else's shelve
  is applied, shown, reviewed or copied, never deleted or restored from here (nor from its diff); the Shelves view
  keeps those. "All shelves" opens it with the same scope and filter.
- **Applying** (`shelves.apply`, `LeftChangesFinder.apply`) merges from `sh:N` at once when nothing conflicts, without
  leaving Changes; only conflicts open the merge view (whose `deleteShelve` finishes the same way). `cm` refuses to merge
  into a workspace with pending changes (unless client.conf's `MergeWithPendingChanges`), so the app offers to shelve
  them away first ("Set aside to apply shelve N"). A recorded shelve of this workspace gets its moved-aside files and
  changelists back; files are detached from the shelve's revisions (`detachReplacedFiles`), kept or deleted, so their
  diffs show the changes. The shelve stays unless deleted.
- **Left changes** (a switch or an update put them aside) are rows too, named "Left on /main/task", with Restore
  (apply, then delete) as in "Welcome back": the banner stays the prompt on the branch they were left on, and shelves
  shelved away (`reason: 'shelve'`) are never offered there nor restored on arrival.

## Two developers on one branch

- `cm` rejects every checkin once the branch head moved ("A merge is needed from changeset…"), even without overlapping
  files. `checkinChanges` recognizes it (`checkinRejection`) and asks (`CheckinRejectedDialog`): when what came in touches
  none of the files and needs no merge, it updates (the guarded update) and checks in again with the same files and comment;
  otherwise it leads to Incoming, and Changes offers to check in once the workspace updated past the rejection.
- When the incoming check already knows the branch moved on (and names who checked in), the button reads "Update & check
  in" and takes the same path up front (`updateFirst`): no overlap updates and checks in without asking; overlap asks.
- An update stopped by colliding local changes (`--dontmerge`) shows a toast leading to Incoming (`explainUpdateConflicts`).
- Local changes to files the branch deleted or moved block the update. `shelveBlockedAndUpdate` shelves just those files
  as a switch shelve record (`reason: 'update'`), undoes them and updates; the "Welcome back" banner offers them back.

