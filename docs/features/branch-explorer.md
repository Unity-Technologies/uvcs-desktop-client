# Branch Explorer and branch switcher

`features/branchExplorer` (layout in `model/`, drawing and hit tests in `canvas/`) and the branch switcher.

## Canvas

The world is drawn relative to a per-frame origin near the screen (`OriginPen`, `draw.pen`, the
world transform carrying the origin in doubles) and bands only as far as the screen, so the canvas, which keeps points in
float32, never sees the millions of px of a whole history (jagged circles and pills zoomed in otherwise); hit tests stay in world doubles.
A link is hit within 6 px of the line itself (`distanceToCurve` cuts it into pieces of 8 px at most, however long),
in screen px when zoomed out.

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
the pending changes already read (`cm status --xml` names a change's merges only in its `MergesInfo`: `Merge from 58,
Cherrypick from 3 to 7`, read by `mergeLinksOf`), so nothing is asked of the server and the watcher refreshes them;
the history is laid out again only when the pending changeset appears, goes or changes what it draws, never re-read.
Hovering tells what it holds; it is selected like a changeset (its details: the changes, what they are on, the
merges in progress, Open Changes, also Enter and a double-click), and the arrow keys stop at it as the next changeset
of its branch. "Go home" and the first view go where the home badge is (`homeTarget`): the pending changes, else the
band of a branch without changesets the workspace is on, else the loaded changeset.

## Branch switcher

Groups and orders branches like the official Desktop client (`branchSwitcherGroups`): /main by its
well-known GUID, the workspace's recent branches, then the rest newest first. Recent branches live in the app's settings
(`recentBranchesByWorkspace`, by workspace GUID): every switch puts its branch first (`SettingsStore.rememberRecentBranch`:
five at most, never /main, as the official client keeps them). The first run takes the official client's from its
`plasticgui.conf`, once (`importLegacySettings`, ARCHITECTURE.md "Own config"); the app never writes that file.
