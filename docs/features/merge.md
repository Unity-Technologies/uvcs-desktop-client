# Merge

The merge page, its conflict resolution, external merge tools and finishing a task (`features/merge`,
`features/mergeTask`, `main/merge/mergeTools`).
The rule that no tool ever opens by itself is in ARCHITECTURE.md ("No external tool opens by itself").

## Merge tools

`cm` has no way to run its merge tool for one chosen conflict (`--resolveconflict` is for directory conflicts only;
`--merge` runs it for every file), so the app runs the tool itself, per file (`main/merge/mergeTools`):

- Found per OS (`knownTools`, `detectTools`), the editors' way (docs/features/open-with.md "Finding apps"): inside
  their app wherever the OS records it (`identity`, `inInstall`: a bundle Spotlight knows, a folder an uninstall entry
  names), else at their usual locations, else on the PATH. The tools: the UVCS merge tool (the Desktop GUI run as `xmerge`: `macplasticx` in PlasticSCM.app, `plastic.exe` next to `cm.exe`, `plasticgui`), VS Code and its forks,
  JetBrains IDEs, Sublime Merge, KDiff3, Beyond Compare, Meld, P4Merge, Araxis and FileMerge (`opendiff`, only with
  Xcode) and WinMerge on Windows, each with the three-way command line of its docs (cross-checked with Git's `mergetools/*`). The user can add any program with an arguments template (`{base}` `{yours}`
  `{incoming}` `{result}` and their `…Name`s). Settings keep the preferred tool (`auto`: the UVCS one, else the first
  found; a pick no longer on offer falls back to it), the user's tools and per-tool arguments. Adding a tool
  (`CustomMergeToolDialog`, `addCustomMergeTool`) makes it the preferred one; when the settings can't be saved, nothing
  is picked and the dialog stays open with what the user typed. The official client's
  merge tools (client.conf's `<MergeTools>`) aren't read, not even on the first run (ARCHITECTURE.md "Own config"):
  the well-known tools are found anyway, and the user adds any other. Every tool opens every text file.
- `mergeTools.resolve` saves the three versions to temp files named after the file (`a.BASE.ts`...), writes the result
  file with the file as it stands in the app (the automatic merge with its markers, or the user's picks), runs the
  tool without a shell (`.cmd` launchers through `cmd.exe`, arguments quoted: `spawnCommand`), and waits. Few tools tell saving from
  cancelling by their exit code, so the result file decides (`judgeToolResult`): unchanged means nothing was resolved;
  saved text becomes the file's decision (markers left count as conflicts left). Text files only: no tool really
  merges binaries, so a binary keeps one of its versions, picked in the app (`waitsForTool`). "Stop waiting" kills the tool process and takes what was saved so far, as soon as it exits: a launcher's
  app still holding its output doesn't keep the file open.
- The workspace is never touched: the outcome is a decision like any other, written when the merge completes.

## Merge page

Every merge opens the merge page (`features/merge`), into the workspace or into a branch on the server, wherever it is
asked for: merging, cherry picking or undoing changesets, applying a shelve, "Merge to … on the server…", finishing a
task (below). One preview, one way to resolve, one button.

The page is a preview until "Complete merge" (into the workspace) or "Merge into <branch>" (into a server branch, the
branch's last name). Its header is one row: a "Preview" pill (its
tooltip: nothing is written until then), the title fitted as a whole (`fitMergeTitle`: the words stay, the branches give
way from their middle; it keeps that room in a narrow window, ARCHITECTURE.md "Long names"), the changesets it combines
("cs:3 → cs:5"; a click lists them with the base), where it stands ("2 conflicts to decide", the full summary in its
tooltip) and the merge button, the primary action only once nothing waits. Merging into a server branch, a second row
holds the changeset comment (`Merge from <source>`) and the button.
Every status reads as what the merge will do, never as done (`mergeStatus`): "Will merge automatically", "Needs your
decision", then the user's choice ("Keeping yours", "Keeping incoming", "Combined", "Edited by you"; "Open in VS Code…",
"Resolved in VS Code" for merge tools): an icon in the list and a chip in the file's toolbar, with a short tooltip. Sides
are "Yours"/"Incoming" in a workspace and "Destination"/"Source" when merging into a server branch (`mergeLabels`), always
next to their branch. Copy stays short: labels name things, tooltips define them, no sentence restates what the page shows.

While two files or more wait for a decision the preferred tool can open, the header's primary action is "Resolve N
conflicts in <tool>" (`ResolveRunControl`, ⇧⌘↩; the caret picks another tool, with how many files each opens, and
whether a file closed unsaved asks before the next): the files open one after the other, each once the one before is
saved and closed (`useResolveRun`, `resolveRun`). Both carets pick the tool like Checkin's picks how to check in
(`toolChoiceEntries`): the button's tool is checked, and picking another (or adding one) only makes it the button's
tool, the preferred one from then on; nothing opens until the button is clicked. Files the tool can't open (binaries, types it isn't for) are left
out and named in its tooltip. While it runs, a strip takes the status's place: a step per file, "Resolving 2 of 5 ·
app.ts in <tool>", Skip this file (closes it there) and Stop (Esc, confirmed while the tool has a file). The list marks
the file open and the selection follows it unless the user looks elsewhere, which never stops the run; files decided in
the app meanwhile are skipped, a file closed unsaved keeps "Needs your decision" and pauses the strip ("closed without
saving", Next file / Stop) unless the setting says to go on, and a tool that can't start stops the run with its reason.
A toast sums it up ("Resolved 4 of 5 in <tool>", "1 still needs you") and focus goes to the first file still waiting,
or to Complete merge. With one file left, its own toolbar is the way.

A conflicting file is read-only. Its toolbar holds the file, its status and the ways out: "Resolve in <tool>"
(`MergeToolButton`, a split button, primary while the file waits and the header offers nothing; disabled during a run:
the other tools found, "Choose another app…", "Edit the text in the app" and the settings behind the caret), then "Keep Yours | Incoming | Both" for the whole file (`KeepChoices`, `conflictChoices`)
and Start over. Below, short one-line views: "Conflicts" with the count left, then "Changes" (the destination now → after
the merge), "Yours", "Incoming" and "Base". Conflicts read as labeled blocks instead of conflict markers
(`conflictHunkCss` over Pierre's view): a header naming the destination's side with Keep yours / Keep incoming / Keep both
for that conflict, its lines, the source's label and its lines. While a tool has the file, a banner says so (Bring to
front, Stop waiting), its conflicts show without choices and the merge can't complete; a toast tells how it ended.
Editing the text in the app opens a banner with Done and Discard edits; the choice shows picked and "Changes" shows what
it produces. Binary conflicts offer only the two versions to keep, as cards, and no merge tool. The
Incoming view resolves update conflicts with the same panel and run (in its update bar); a merge into a server branch
resolves its files the same way as a workspace merge. A file
that merges automatically is never edited; its menu only overrides it by keeping one version.

Once merged into the workspace, the page says so ("Merge complete", `MergeCompleted`) and leads to Changes ("Review and
check in"). Merged into a server branch there is nothing left to do there: the page goes back to where it was opened
from, and the progress card ends as the one toast, "Merged subtask into child_1 (cs:812)" (branches named as briefly as
tells them apart, `distinctBranchNames`), with "Show in Branch Explorer" (`completeMerge`). When someone checked in on
the destination while it merged, `cm` leaves the merge's changeset beside the new head: the page that merges it into the
branch opens instead (`followUpMerge`), with a toast saying why. The page reads its plan once (`MERGE_PLAN_QUERY`):
no refresh, not even the one after the merge, previews it again.

Complete merge writes each conflicting file's decision into the workspace, after `cm merge` (`runMerge`): the text
decided, or, keeping the incoming version of a text file, the text the page read (`resolutionOf` carries it when it
writes back byte for byte, UTF-8); only binaries and text in other encodings are read again, with a `cm cat` each.
A merge into a server branch has no workspace to write in: `cm merge --to` reads every file's decision from a JSON file
(`--fileconflictsresolutionsfile`, written by `fileConflictResolutionsFile`): `{ "resolutions": [{ "path", "keep": "source" |
"destination" } | { "path", "resultFile" }] }`, by the path `cm merge` printed in the plan. A side kept, even an
incoming text the page read, is named, so `cm` uploads nothing for it; a decided text goes in a result file whose bytes
`cm` checks in as they are. `cm` leaves both files alone; `runMerge`'s temp folder holds them until it ends.

Merges hold hundreds of conflicting files and thousands of changes. Every conflicting file's three versions load at
once (its status needs its automatic merge); each file merges once, when its versions are in (`loadConflict`), and
keeps its state while nothing about it changes (`buildStates`). The three-way merge (`diff3`) draws node-diff3's diff3
regions over Myers diffs of each side, whose time goes by the lines changed (lockfiles repeat lines by the thousand).
The list and Incoming render only the rows in view; the file behind the selection follows it deferred, so arrowing
never waits for a file to highlight. Conflicts, Base and the hand editor follow the diffs' size rule
(`syntaxHighlighting`), and Base (when big) and the hand editor render only the lines in view.

## Finishing a task

A task branch (`isTaskBranch`: one with a parent) is finished by merging it into its parent on the server: Branch ▸
"Merge to <parent> on the server…", or, on a clean workspace on the task branch, the suggestion in Changes ("Merge
subtask into child_1", `MergeTaskSuggestion`, which stays cheap: one `cm find` of the branch, one changeset and one merge
link with `limit 1`). Both open the merge page with the task (`openTaskMerge`, the page's `task`: `TaskMerge`), and so
does "Merge to another branch on the server…" on a task branch. The page then:

- starts the comment from the branch's ("Merge /main/t1: Add the login screen", `defaultMergeComment`);
- offers, under the comment, "Mark the code review as reviewed (“<title>”)" when the branch has a review not reviewed
  yet (its status beside it, a click opens it; the review comes from the list the branch chips share,
  `useReviewsByBranch`), and "Hide the branch afterwards" (`TaskMergeOptions`);
- once merged, does what was picked and remembers where the task landed (`finishMergedTask`), so Changes shows the
  finished task: where it went, "Switch to <parent>", "Start next task…", "Hide branch" (`FinishedTaskCard`). The merge
  that finishes it after its destination moved carries the choices made.

Its conflicts are resolved on the page, on the server, as any merge's. The header offers the workspace way too, "Resolve
in the workspace instead" (`ResolveInWorkspaceMenu`, `workspaceResolutions`): "Merge <parent> into <task> first"
(switches to the task when needed; resolve, check in, and merge the task again, clean) or "Merge on <parent> in this
workspace" (switches to the parent when needed; checking in finishes the task). Labels name the branches as briefly as
tells them apart, the tooltips in full. The changeset a moved destination left is only merged on the parent.
