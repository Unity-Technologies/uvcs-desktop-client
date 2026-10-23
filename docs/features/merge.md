# Merge

The merge page, its conflict resolution, external merge tools and finishing a task (`features/merge`,
`features/mergeTask`, `main/merge/mergeTools`).
The rule that no tool ever opens by itself is in ARCHITECTURE.md ("No external tool opens by itself").

## Merge tools

`cm` has no way to run its merge tool for one chosen conflict (`--resolveconflict` is for directory conflicts only;
`--merge` runs it for every file), so the app runs the tool itself, per file (`main/merge/mergeTools`):

- Found per OS (`knownTools`, `detectTools`), the editors' way (docs/features/open-with.md "Finding apps"): inside
  their app wherever the OS records it (`identity`, `inInstall`: a bundle Spotlight knows, a folder an uninstall entry
  names), else at their usual locations, else on the PATH. Each shows its app's icon (`AppIcons`). The tools: the UVCS
  merge tool and Semantic Merge (the Desktop GUI run as `xmerge` or `semanticmerge`, `uvcsGui`: `macplasticx` in
  PlasticSCM.app, `plastic.exe` next to `cm.exe`, `plasticgui`), VS Code and its forks, JetBrains IDEs, Sublime Merge,
  KDiff3, Beyond Compare, Meld, P4Merge, Araxis and FileMerge (`opendiff`, only with Xcode) and WinMerge on Windows,
  each with the three-way command line of its docs (cross-checked with Git's `mergetools/*`). The user can add any
  program with an arguments template (`{base}` `{yours}` `{incoming}` `{result}` and their `…Name`s;
  `CustomMergeToolDialog`, `addCustomMergeTool`, which picks it nowhere: the caller opens the file in it or picks it for
  a row). Settings keep the user's tools and per-tool arguments ("How <tool> opens", in the row's dialog below).
- **What opens which file** (Settings › Merge, `MergeToolsPane`; `mergeToolFor`, `useFileMergers`): rows tried top to
  bottom, the first that matches wins (`mergeToolRules`), each a list of file patterns and a tool or UnityYAMLMerge;
  last, every other file (`mergeTool`: `auto`, the UVCS one, else the first found; a pick no longer on offer falls back
  to it). A file opens in a `Merger`: a tool, or UnityYAMLMerge with a fallback tool for what it can't merge
  (`fallbackToolId`, `auto` until picked: every other file's tool). A row of UnityYAMLMerge names the newest editor's
  (`unityyamlmerge`) or one editor's (`unityyamlmerge:<version>`); on a file UnityYAMLMerge wouldn't run on (not Unity
  YAML on both sides, or decided by the user already: `smartMergeVersions`) the row opens its fallback straight away,
  so "Resolve in…" names what really opens. Patterns (`lib/filePatterns`) are extensions (`.cs`), names with `*` and
  `?` (`*.prefab`), or paths from the workspace's root with `**` crossing folders (`Assets/Data/**`; one holding a space
  goes in double quotes, `"Assets/Third Party/**"`), matched in any case on Windows and macOS and exactly on Linux
  (`fileNamesIgnoreCase`). A row whose tool, or editor, isn't found here is passed by, and says so ("Not found on this
  computer", named by `knownNames`); removing a tool of the user's drops its rows and makes it no row's fallback. With
  nothing imported, the rows are Unity assets in UnityYAMLMerge (`UNITY_YAML_MERGE_RULE`, `UNITY_YAML_PATTERNS`: `.unity`,
  `.prefab`, as the official client sets them up; Unity's Manual lists `.meta` too, but UnityYAMLMerge rejects real
  `.meta` files, "not a valid text serialized YAML file", in every version tried, so a `.meta` conflict opens in its own
  row's tool; users add other
  YAML-serialized assets, `.asset`, `.mat`, `.controller`…, to the row) and C#, Visual Basic
  and Java in Semantic Merge (`SEMANTIC_MERGE_RULE`), as the official client sends them. The pane lists the rows read-only, one line each, all 34px
  (`--merge-row-height`, a little roomier than a list's), in one grid (`MergeToolsPane`, `mergeToolRows`): a rule's
  file types in the code font, as many as the files column holds then " +N" (`fitFileTypes`, by the text's width as the
  row draws it: `useFilesFit` measures the column as the pane resizes and the text in its font, `fitsWidth`; every one
  in the tooltip; the list is cut, never the count), then the tool: a fixed icon cell and its name, every icon in one column (the pinned Unity Editor's version
  after UnityYAMLMerge's name, quieter). The tool's tooltip is how it's launched, its command line quoted where needed
  (`commandLine`), with "If it can't merge: <tool>" for UnityYAMLMerge; a tool that isn't here shows its name quieter,
  a warning in its icon cell and why in the tooltip; with no merge tool at all, every other file's row reads "No merge
  tool found". Every other file's row is last and names the tool that really runs. Only in a very narrow pane does the
  tool go under the file types (a container query on the frame). A row's click, or Enter, opens its edit dialog; its
  "…", shown on hover or focus, holds Edit…, Move up, Move down and Remove (`rowMenuEntries`; every other file's only
  Edit…). The dialog (`MergeRuleDialog`, `mergeRuleDraft`), each field a label, its control and its hint: "Files"
  (chips: `TokenField`, `lib/tokenInput`: a space, comma, semicolon or Enter makes a chip, double quotes keep spaces in
  one, pasting splits into chips, Backspace in an empty field takes the last away, ArrowLeft moves onto the chips and
  Backspace or Delete removes the one it's on (`tokenKey`), each chip's × removes it, each value once; its visible label
  names it for screen readers; Enter never submits; what's typed but not a chip yet counts, and Save makes it chips: `draftPatterns`), "Opens in" (the Apps page's picker, `AppPicker`: its icon, name and path; each tool once:
  the UVCS merge tool, Semantic Merge, UnityYAMLMerge with the path of the editor's picked under it, as every tool shows
  the program that runs, and Smart Merge, Unity's name for it, only in its tooltip, then the others found and the user's, `toolChoices`), then for a tool "How <tool>
  opens", its arguments in place (stored per tool, so they apply wherever it opens; "Back to its own arguments",
  "Remove <tool>" for the user's own, which removes it everywhere with the rows that open in it, this one too, and
  closes the dialog; saved with the rule, `argsToSave`), or for UnityYAMLMerge (whose arguments are
  fixed, `UNITY_YAML_MERGE_ARGS`) "Unity Editor" (a select: "Newest installed (6000.5.0f1)", then each installed
  version; one gone stays, saying so: `editorOptions`) and "If it can't merge" (`fallbackChoices`). Its menus scroll when long (ARCHITECTURE.md "Long menus scroll"). Save stays off until a rule has a
  file type and the arguments name `{result}` (`saveProblem`); a new rule is added only on Save. No dialog opens over
  it but "Choose another app…", to add a program, which shows and saves at once, before the list holds it
  (`withAddedTools`; `savedDraft` keeps an id picked as it is). Binary files have no rows: no tool opens them.
- **No "Automatic" in Settings › Merge.** Every other file's tool and UnityYAMLMerge's fallback store `auto` until one
  is picked (`AUTO_MERGE_TOOL`: "not picked yet"), and the pane and the dialog show the tool it resolves to, the UVCS
  merge tool, else the first found (`resolvedToolId`, `MergeToolList.preferredId`), as the merge page opens it; picking
  one stores its id, while leaving it untouched keeps `auto` (`savedDraft`). An "Automatic" choice was tried and
  dropped: it hid which tool runs and how it's launched, and its arguments couldn't be seen or edited. The Apps page
  keeps its Automatic for editors and terminals.
- **Imported once** from the official client (client.conf's `<MergeTools>`, `readLegacyMergeTools`,
  `legacyMergeToolSettings`; ARCHITECTURE.md "Own config"), on the first run that has rows (`legacyMergeToolsImported`,
  apart from the recent branches' import, so a user who ran the app before gets it too). With nothing to import, the rows are the app's own
  (`DEFAULT_MERGE_TOOL_RULES`), without Semantic Merge's for a user who picked their own tool. Each entry for some files
  becomes a row, by the official client's order; its entry for every text file becomes every other file's tool, only
  while the user's is still `auto` (not picked yet), and nothing after it is read, as the client never goes past it (even when the app can't read its tool). An entry whose
  first tool is `UnityYAMLMerge` becomes a row of UnityYAMLMerge for its extensions, the tool chained after it its
  fallback (`auto` when there's none, or when it's every other file's tool anyway: `withAutomaticFallback`); its
  stored path is dropped, the app runs the newest Unity Editor's. With no such entry, the app's own Unity row comes
  first (`UNITY_YAML_MERGE_RULE`). The client's own tools become the app's (`plastic xmerge`,
  `plasticgui`, `macmergetool`, `gtkmergetool` the UVCS merge tool; `semanticmerge` Semantic Merge); a known program
  (VS Code, Rider, KDiff3, P4Merge...) becomes the app's own entry for it, with the app's arguments; any other program
  becomes a tool of the user's, `@basefile` `@sourcefile` `@destinationfile` `@output` and their `…symbolic`s turned
  into `{base}` `{incoming}` `{yours}` `{result}` and their names, an argument holding a variable the app has no value
  for (`@fileencoding`, `@mergetype`...) dropped, with the switch before it when the variable was the whole argument
  (`-e @fileencoding`). Left out: binary entries and binary merges, the client's own scripts
  (its `diffscripts` folder: Word documents, which are binary), regular expressions, a command that saves nowhere. While every other file opens in the UVCS merge tool once imported
  (`auto`, or the UVCS merge tool picked by name: `sendsCodeToSemanticMerge`, the one test of both paths), C#, Visual Basic and Java go to Semantic Merge (the client does so), but those
  a row sends elsewhere; a user who picked their own tool for every other file keeps C# there, and with no client.conf
  to import such a user gets the default rows without Semantic Merge's, the Unity row kept (`importMergeTools`); a row that sends files where every other file
  goes anyway, and that no later row could take, is dropped (the Windows client's `.meta` row).
- `mergeTools.resolve` saves the three versions to temp files named after the file (`a.BASE.ts`...), writes the result
  file with the file as it stands in the app (the automatic merge with its markers, or the user's picks), runs the
  tool without a shell (`.cmd` launchers through `cmd.exe`, arguments quoted: `spawnCommand`), and waits. Few tools tell saving from
  cancelling by their exit code, so the result file decides (`judgeToolResult`): unchanged means nothing was resolved;
  saved text becomes the file's decision (markers left count as conflicts left). Text files only: no tool really
  merges binaries, so a binary keeps one of its versions, picked in the app (`waitsForTool`). "Stop waiting" kills the tool process and takes what was saved so far, as soon as it exits: a launcher's
  app still holding its output doesn't keep the file open.
- **UnityYAMLMerge** (Unity's Smart Merge, by the Unity Manual's name for the tool, `UNITY_YAML_MERGE_NAME`: it merges
  scenes, prefabs and other assets by their objects) runs only for a file whose row picks it, and only on Unity YAML the
  user decided nothing for yet (`smartMergeVersions`, from `decidedByUser`): its fallback opens only when it doesn't
  merge the file, and a toast says so ("UnityYAMLMerge couldn't merge Hero.prefab", `fallbackOpensMessage`; a run's
  strip names the fallback once it has the file, `runStripWords`). Two calls, so each phase shows what really happens:
  `mergeTools.smartMerge` with the versions the page already read and the editor the row names (no `cm` command), while
  the file reads "Merging…" and its banner "Merging <file> with UnityYAMLMerge…" with Stop (stopping it opens nothing,
  even a stop that reaches main as it ends on its own: the renderer remembers it, `stopMergeToolSession`,
  `wasStopped`); then, if it didn't merge, `mergeTools.resolve` opens the fallback as any tool. With no fallback found,
  the file fails to open and says why. While UnityYAMLMerge (or a tool) has the file, its menu
  offers no Keep or Start over, as its toolbar offers none (`conflictMenuEntries`); and should the user decide the file
  meanwhile (from another file's selection), that decision stands: UnityYAMLMerge's merge is dropped and nothing opens
  (`ResolveOptions.stillUndecided`). A file goes to it when its two sides are text and start with
  Unity's YAML header (`isUnityYaml`), whatever its extension (`unityYamlMergeTakes`, the one test of the page and of
  main); a `.meta` file has none, and UnityYAMLMerge rejects it anyway, so it opens straight in a tool, the rule's
  fallback if a user adds `.meta` to the Unity row (the sandbox's `Player.prefab.meta` opens in every other file's). A base
  revision of Unity's YAML that was an empty file (checked in empty, then filled differently on each side) becomes an
  asset with no objects (`EMPTY_UNITY_YAML`), as UnityYAMLMerge refuses an empty file; a file added on both sides never gets here, `cm` makes
  it a directory conflict. It runs with
  no window (`windowsHide` on Windows, `toolSpawnOptions`) and no fallback tool of its own (`UNITY_YAML_MERGE_ARGS`: `merge -h
  --force --fallback none`: `--fallback none` keeps the tools its `mergespecfile.txt` names from ever opening, the
  rule's fallback opens instead; `--force` changes nothing for `.unity` and `.prefab`, and lets it merge any
  YAML-serialized asset a user adds to the row instead of handing it back). Only exit code 0 counts (`judgeSmartMerge`): on 2 (conflicts
  left) it still writes a result holding the base's values where the sides disagree, so that result is dropped; 1
  means it couldn't read or merge the file. A failure other than conflicts left is warned in the console (`[smart
  merge]`, with the end of its stderr). Its merge reads "Merged by UnityYAMLMerge"; "Resolve in…" on it opens the tool on
  UnityYAMLMerge's result, and Start over makes the file undecided again, so the next "Resolve in…" lets UnityYAMLMerge try
  again. Its size ceiling is the page's: a version over `MAX_TEXT_BYTES` (10 MB) is a binary to the page, which no tool
  opens, so UnityYAMLMerge isn't tried on it either. In practice it's lower: a text conflict of about 3.5 MB overflows the
  stack of the page's own line merge (`diff3Merge`, as it loads the file), before UnityYAMLMerge could be asked. It comes
  from every Unity Editor installed, the newest release first
  (`findUnityYamlMerges`, `compareUnityVersions`: releases before alphas and betas; `UnityYamlMergeTool`, its id
  `unityyamlmerge:<version>`, and `unityyamlmerge` for the newest one, `unityYamlMergeOf`), found as Unity Hub keeps editors
  (`findUnityEditors`): its editors folder (`/Applications/Unity/Hub/Editor`, `C:\Program Files\Unity\Hub\Editor`,
  `~/Unity/Hub/Editor`), the folder picked in the Hub (`secondaryInstallPath.json` in the Hub's config folder), the
  editors located by hand (`editors-v2.json`, `editors.json`) and the install made without the Hub; inside an editor,
  `Contents/Helpers` on macOS since Unity 6.3 (`Contents/Tools` before), `Data/Tools` on Windows and Linux. Settings'
  Unity row says whether it's found, and which editor's it uses in its tooltip (`unityRowNote`, `unityRowTip`).
  Sandbox: `scripts/sandboxes/smart-merge.sh`.
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
The list (`MergeItemList`) is every list of changed files (ARCHITECTURE.md "Lists of changed files") in two groups,
"Conflicts" then "Changes to apply" (`mergeItemGroups`), each by path: the filter (the "!" chip for conflicts,
`mergeItemTones`), List or Tree, and several items selected at once, whose menu keeps yours or the incoming version of
every conflicting file among them, or the base when every one of them has one (`keepVersionEntries`). One item's menu is any changed file's (ARCHITECTURE.md "One
menu": history, open or save the incoming version, Copy) with what a merge adds (`mergeItemMenu`): a conflicting file, the same
entries as in Incoming (`conflictMenuEntries`), "Resolve in <tool>" (what the file opens in, `useFileMergers`, UnityYAMLMerge included; disabled while files resolve one by one) and "Resolve with ▸" every other way, opening it there this once (`otherMergers`: every other tool, and UnityYAMLMerge on Unity YAML; none while files resolve one by one), Keep yours,
incoming or base (where it has one), Start over once decided, annotate at the incoming revision `cm` names for it, and "Open version ▸" Yours (the
workspace file; the destination's version merging into a server branch), Incoming and Base (`openableVersions`): a
text in the user's editor, a binary with its default app (`oneClickApp`: the editors are for text; a known binary is one before its versions
are read, `opensAsBinary`). A binary's
versions open only from there: its menu drops the list's "Open this revision in <editor>" and "Open this revision
with ▸", which would open the incoming one a second way, and keeps "Save this revision as…" (`withConflictOpening`,
in Incoming too). A version taken
out of the repository opens under a name that tells which it is (`versionCopyName`: `hero.INCOMING.psd`, as the merge
tools name theirs), so two versions open side by side in one app don't look alike; a directory conflict its
panel's choices, Keep both under the name the panel suggests. Keep both counts as decided only while its name is one
name, never a path, `.` or `..` (`isValidRenameName`, which main checks again; the field says what is wrong:
`renameNameProblem`). A directory conflict holding another conflict (a folder added on both sides, a file in it
changed on both) is its folder's row in a tree: selecting that row selects the
conflict, and its menu acts on it alone (`mergeItemAt`, `mergeItemsActedOn`). A clean change isn't annotated: `cm` names only the
merge's changesets, where the file may not have changed. A folder added with its files is listed once, through them
(ARCHITECTURE.md "Folders once"). The page starts on the first item that needs the user in the order the list shows
(`firstWaiting`), and goes back there after a run. Directory conflicts are named in plain words ("Added on both sides
with the same name", `directoryConflictWords`), not `cm`'s ("Evil twin conflict"). Sandbox:
`scripts/sandboxes/merge-conflicts.sh`. A text with a line too long to draw unwrapped wraps, as in a diff, and isn't edited in the app:
diff.md "Long lines".
Every status reads as what the merge will do, never as done (`mergeStatus`): "Will merge automatically", "Needs your
decision", then the user's choice ("Keeping yours", "Keeping incoming", "Keeping base", "Combined", "Edited by you"; "Open in VS Code…",
"Resolved in VS Code" for merge tools): an icon in the list and a chip in the file's toolbar, with a short tooltip. Sides
are "Yours"/"Incoming" in a workspace and "Destination"/"Source" when merging into a server branch (`mergeLabels`), always
next to their branch. Copy stays short: labels name things, tooltips define them, no sentence restates what the page shows.

While two files or more wait for a decision a tool can open, the header's primary action is "Resolve N conflicts in
<tool>", or "Resolve N conflicts one by one" when they open in different tools (`ResolveRunControl`, ⇧⌘↩, `runLabel`,
`runMerger`): the files open one after the other, each in what it opens in (`planRun`, `RunStep`), once the one before is
saved and closed (`useResolveRun`, `resolveRun`). Its caret runs every file in one other tool, this once ("All in
Meld · 5 conflicts", `runPlans`, `allInLabel`), and holds whether a file closed unsaved asks before the next. The
carets never change the settings (`toolChoiceEntries`: picking a tool opens in it at once); Settings › Merge says
which tool each file opens in. Files the tool can't open (binaries, types it isn't for) are left
out and named in its tooltip. While it runs, a strip takes the status's place: a step per file, "Resolving 2 of 5 ·
app.ts in <tool>", Skip this file (closes it there) and Stop (Esc, confirmed while the tool has a file); while UnityYAMLMerge merges the file, "with UnityYAMLMerge", Skip and Stop stop it, and Esc needs no confirmation (`runStripWords`). The list marks
the file open and the selection follows it unless the user looks elsewhere, which never stops the run; files decided in
the app meanwhile are skipped, a file closed unsaved keeps "Needs your decision" and pauses the strip ("closed without
saving", Next file / Stop) unless the setting says to go on, and a tool that can't start stops the run with its reason.
A toast sums it up ("Resolved 4 of 5 in <tool>", "1 still needs you"; what UnityYAMLMerge merged apart, "Resolved all 3 conflicts: 2 with UnityYAMLMerge, 1 in <tool>") and focus goes to the first file still waiting,
or to Complete merge. With one file left, its own toolbar is the way.

A conflicting file is read-only. Its toolbar holds the file, its status and the ways out: "Resolve in <tool>"
(`MergeToolButton`, the file's own tool, a split button, primary while the file waits and the header offers nothing;
disabled during a run: the other tools found, each opening the file at once, this once, "Choose another app…" (added,
then opened), "Edit the text in the app" and the settings behind the caret), then "Keep Yours | Incoming | Both | Base" for the whole file (`KeepChoices`, `conflictChoices`;
Base, the version before either side changed it, only for a file that has one: not one added on both sides, and never when undoing a changeset, where `cm` takes the changeset undone as the base and keeping it would put the change back: `offersKeepBase`, `baseIsUndoneChange`; the same rule for every Keep base below) and Start over. In a narrow pane the controls wrap within themselves, the Keep choices under the tool's button, so none
is cut off. Below, short one-line views: "Conflicts" with the count left, then "Changes" (the destination now → after
the merge), "Yours", "Incoming" and "Base". Conflicts read as labeled blocks instead of conflict markers
(`conflictHunkCss` over Pierre's view): a header naming the destination's side with Keep yours / Keep incoming / Keep both
/ Keep base for that conflict (in a narrow pane just Yours | Incoming | Both | Base, a container query), its lines, the
source's label and its lines. The markers hold only the sides: the
automatic merge keeps each conflict's base (`ConflictDocument.conflictBases`), and the decision carries the bases of
the conflicts left, dropping each one decided (`decideConflict`), so a conflict's base is its own even where others
show the same sides. Text edited by hand or saved in a tool carries none: its conflicts offer no Keep base. While a tool has the file, a banner says so (Bring to
front, Stop waiting), its conflicts show without choices and the merge can't complete; a toast tells how it ended.
Editing the text in the app opens a banner with Done and Discard edits; the choice shows picked and "Changes" shows what
it produces. Binary conflicts offer the versions to keep as cards, each side's and the base's (where the file has one),
and no merge tool; one whose versions render (3D models,
images: `rendersVersions`) also shows each side against the base and the base itself ("Choose | Yours | Incoming |
Base"), and a model's cards tell what each side changed since the base (docs/features/model-diff.md "In a merge").
Deciding often means looking at the versions in the artist's own app (two PSDs in Photoshop, two FBX in Blender): the
binary's toolbar holds "Open version" (`OpenVersionMenu`), a submenu per version (Yours, Incoming, Base when there is
one), and each card's menu (right-click, the menu key) its own version; both list "Open" with its default app, then
every app, "Choose another app…" and "Manage apps…" (`versionAppEntries`, over `openRevisionWithEntries`; no editor is
marked the default there). Nothing opens but on the user's pick. A
binary's versions (textures, models, scenes: up to hundreds of MB each) are read only while it shows (below); its
cards can be picked before their previews come, and when its versions can't be read, a card's icon says why. The
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
decided, or, keeping the incoming version or the base of a text file, the text the page read (`resolutionOf` carries
it when it writes back byte for byte, UTF-8); the incoming versions and bases of binaries and of text in other
encodings are saved by `cm` straight into the workspace (the item at the source's point or at the base's changeset,
`sourceVersionSpec`, `baseVersionSpec`), all of them with one `cm cat` per batch (`catBatchesOf`), in a process: the page never holds their
bytes, and keeping yours reads nothing. `cm merge` has no option to keep the base: the app writes it like any decided
text. Once `cm merge` ran, cancelling doesn't stop these writes: the merge is in the
workspace by then, so a version kept that can't be saved leaves its file as yours, and the merge's toast names it
("Merge applied, but 2 files still hold yours", `keptVersionNotSaved`). `cm cat` goes on after a problem: it prints a
`not found <spec>` line per revision it can't resolve, a purged line naming the file of each revision whose content
was purged (diff.md "A purged version"), and a line naming nothing per download that failed (`explainCatFailure`,
shared with `RevisionCat`). A failure with such an unnamed line is tried once more for the files
it didn't name, as saving a version again changes nothing; what fails again is worded as uncertain ("may not hold the
version you kept", `keptVersionMaybeNotSaved`). `cm merge --merge` can't take each file's decision in a workspace
(`--fileconflictsresolutionsfile` works only with `--to`), and `--keepsource` keeps every file's.
A merge into a server branch has no workspace to write in: `cm merge --to` reads every file's decision from a JSON file
(`--fileconflictsresolutionsfile`, written by `fileConflictResolutionsFile`): `{ "resolutions": [{ "path", "keep": "source" |
"destination" } | { "path", "resultFile" }] }`, by the path `cm merge` printed in the plan. A side kept, even an
incoming text the page read, is named, so `cm` uploads nothing for it; a decided text goes in a result file whose bytes
`cm` checks in as they are. The file names no base to keep, so a base kept goes in a result file too: its text as the
page read it, or its revision saved there by `cm cat` (one per batch, in a process) before `cm merge` runs, which a
base that can't be read stops with nothing merged. `cm` leaves both files alone; `runMerge`'s temp folder holds them
until it ends.

Merges hold thousands of conflicting files and changes. A binary never merges line by line, so its status is "Needs
your decision" before any of its versions is read: the preview's `cm ls` of the destination's tree names each
revision's type, and a destination revision `cm` keeps as `bin` makes the file a known binary (`destinationIsBinary`,
`isKnownBinary`; Incoming's update conflicts, by the incoming revision's type), with no command more, even if its bytes
would read as text: `cm`'s own merge doesn't merge it line by line either. Its three
versions are read only while the file shows, once the selection settles on it (`readsOnOpen`, `useFileConflicts`'
`openFile`, `useSettledValue`: holding ↓ through a folder of textures reads none it passes), in one batch. A file whose
destination is text may still hold a binary version: its versions are read, and their bytes tell, as for every text
file (`loadConflict`). Every other conflicting file's three versions load at once (`upFrontReads`: its status needs
its automatic merge), watched by one observer whose results reach the page at most once a frame
(`useQueriesByFrame`, `watchQueriesByFrame`): `useQueries` rendered the page, and compared every query's options
again, for each version that answered, freezing it for seconds. Frames stop while the window is hidden, minimised or
covered, so results also arrive after `HIDDEN_HAND_OVER_MS` without one: a merge loading behind other windows keeps
merging its files instead of merging them all at once when the user returns. Where the versions come from: the base
and the source are read as the item at their changesets (`itemid:N#cs:M@repo`, `conflictedFilesOf`), in a few batched
`cm cat`s (ARCHITECTURE.md "Server budget": `RevisionCat`): 3,318 conflicting files cost 28 or 29 commands instead of
9,954, though the server still looks each item up on its own. The destination is read by its revision, which the
preview's `cm ls` of the destination's tree already named with its hash (`destinationRevisionId`,
`withConflictRepositories`): the workspace's file is read instead where it is that revision unchanged, as it mostly
is in a workspace merge (`WorkspaceCopies`), with no `cm` command at all. Each file merges once, when its versions
are in (`loadConflict`), and keeps its state while nothing about it changes (`buildStates`). The list's items come
from the plan alone (`buildMergeItems`), so they are sorted and laid out once; where each conflict stands is the
page's `MergeProgress`, which the rows, menus and detail read by key, so a status changing only draws again the rows
in view. The three-way merge (`diff3`) draws node-diff3's diff3 regions over Myers diffs of each side, whose time goes
by the lines changed (lockfiles repeat lines by the thousand). The list and Incoming render only the rows in view; the
file behind the selection follows it deferred, so arrowing never waits for a file to highlight. Conflicts, Base and
the hand editor follow the diffs' size rule (`syntaxHighlighting`), and Base (when big) and the hand editor render
only the lines in view.

### Stepping through conflicts

A conflicting file steps through its conflicts as a diff steps through its changes (diff.md "Moving through changes"),
with the same keys, ⌥↓ ⌥↑ and F7 ⇧F7 (`nextConflict`, `previousConflict`), and arrows around "2 of 3" at the end of its
view bar (`ConflictNavigator`, on `useStepNavigation`). The keys work from anywhere in the file's panel, its views'
segments included (`STEP_FRAME`), from the list and with nothing focused. A conflict moved to comes a few rows from the
top unless it's all in view, and lights up (`useConflictView`: Pierre draws each one from its actions row down to its
end marker). Every conflict shown is one still to decide: resolving one with its header's choices (`resolve` in
`ConflictHunks`) takes it out of the text and the count, and the next move goes on to the one that took its place, or
back to the one before it (`ConflictPlace`: the screen can't tell, with every conflict in view). That holds until the
view is scrolled more than a few rows away, however it scrolls (the shorter text pulling it back at the end of the file
doesn't count), or the conflicts change otherwise (started over, saved by a merge tool). A binary waiting for the
version to keep is one conflict, "1 of 1"; a file that couldn't be read has none, and its arrows still go on. The views
that are diffs (Changes, Yours, Incoming) keep their own arrows through their changes, and the base none. But a file
whose last conflict is resolved while it shows keeps the conflict arrows over its Changes, "No conflicts", until the
user leaves the file: the next move goes straight on to the next file that waits instead of through the changes the
merge makes (`justDecided`, `LoadedFileDiff`'s `stepsThroughChanges`). Started over, the file opens on its conflicts
again (`rememberConflicts`).

Past the last or first conflict, the arrows go on to the next file's first conflict or the previous file's last, as
the list shows them, but only to the files still waiting for the user: those decided or merged automatically are
passed by (`conflictStepKeys`; the file shown stays among them, so the arrows know where they are once it's decided).
Directory conflicts aren't stepped to: they have no conflicts to step through. The diffs of a conflicting file go on to
the same files past their changes. Incoming steps through its update conflicts the same way. There are no first and
last conflict keys: Home and End are the list's, and the official client's "next unresolved conflict" is every move
here, since a resolved conflict is no longer one.

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
