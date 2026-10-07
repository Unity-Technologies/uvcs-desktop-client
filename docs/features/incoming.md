# Incoming

Incoming (`features/incoming`) shows what the branch has that the workspace doesn't, what of it collides with local
changes, and the update that takes it. How the app learns there is something incoming (the incoming check, the chip,
its card) is ARCHITECTURE.md "Refresh"; this is the view.

## Changesets, then files

The left pane is the incoming changesets above the files, as every list of changed files shows them (ARCHITECTURE.md
"Lists of changed files"). The files are what Incoming is for:

- **The changesets' section** (`IncomingChangesetList`) shows "All incoming changes" and three changesets, then
  scrolls inside itself (`changesetListMaxHeight`, `CHANGESETS_SHOWN`), so the files always start right below. It
  closes, and stays closed across sessions (`useIncomingViewStore`); closed, its header sums the changesets up: "3
  changesets · Ana, Luis" (`changesetsSummary`). Each row is what the list of changesets read (comment, author, date):
  nothing is asked of `cm` per row, and no row counts its files. It holds the changesets read so far, 200 at a time
  (`useIncomingChangesetList`): while older ones remain it ends with "Show 200 more" (`IncomingShowMore`) and its
  counts say "200+" (ARCHITECTURE.md "Server budget").
- **"All incoming changes"**, where Incoming opens, lists the whole update: the diff from the loaded changeset to the
  head that Incoming reads anyway. The files that collide with local changes (changed on both sides, or changed
  locally and deleted or moved on the branch: `collidesWithLocal`) are a group of their own, "Conflicts with your
  changes", before "Changes to apply" (`incomingFileContent`), in the merge page's words: an update with conflicts is
  a merge. With no conflicts there are no groups. The line under the header says what updating does to the workspace:
  "1 conflict with your changes · 13 to apply", or "14 changes to apply · Your local changes stay as they are"
  (`incomingFilesSummary`). The "!" chip filters the conflicts ("Conflicts with your changes", `INCOMING_TONE_LABELS`).
- **A changeset** lists the files it changed and shows its details as History does (`ChangesetDetails` without its
  own files: they are the list). Its files are its diff, read once its row stays selected (`useSettledValue`) and kept
  for good: the very query its details panel elsewhere reads (`useDiffEntries`, one `cm diff cs:N`), so arrowing
  through changesets reads none of those it passes, and coming back to one reads nothing. ✕ in the files' header goes
  back to all of them.

A file selected shows its diff: across the whole update, or what its changeset did. A file that conflicts shows the
conflict panel only in "All incoming changes", where conflicts are resolved: the update merges the whole of it. In a
changeset it shows what that changeset did, its conflict mark still on its row.

## Menus

A file's menu is a diff's (`diffEntryMenu`, on `changedFileMenu`: history, annotate, open or save the revision, Copy),
read from the scope's diff (`incomingDiffTarget`). In "All incoming changes" the conflicts selected add "Keep yours" and
"Keep incoming" (`keepVersionEntries`), for several at once too. A changeset's row has the changeset's menu
(`changesetMenu`), the same as in History.

## Updating

The update bar (`UpdateBar`, `collisionMessages`) says what updating does and waits for every conflict to be decided;
conflicts resolve with the merge page's panel and runs (docs/features/merge.md). Sandbox: `scripts/sandboxes/incoming.sh`.
