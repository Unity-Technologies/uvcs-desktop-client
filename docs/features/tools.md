# Tools

Programs the user runs on what they select: a script that posts a changeset to a tracker, a build of a branch, an
upload of a file. Each one runs only when the user picks it from an object's menu (ARCHITECTURE.md "No external tool
opens by itself"). The official client calls them "external tools".

## A tool

A tool (`Tool`, `shared/domain/tools.ts`, kept in `AppSettings.tools`) has a name, a program, its arguments and what it
runs on (`TOOL_TARGETS`): files and folders (on disk, or a revision of one), changesets, branches, labels and shelves
(a CI run of a shelve; the official client had no shelve tools). Code reviews, attributes and repositories aren't
targets: a review points at a branch or changeset that has its tools already, an attribute's value belongs to those
objects, and `{repository}` names the repository from any of them.

- **Arguments are a list**, one argument each, and never go through a shell (`toolArgs`): a placeholder fills one
  argument, so a path with spaces needs no quotes and nothing in a value is read again. Settings edits them on one line,
  as the merge tools' are (`parseArgs`, `formatArgs`).
- **Placeholders** (`TOOL_PLACEHOLDERS`, filled by `placeholderValues`): `{object}` (a full path, `cs:12`, `br:/main`,
  `lb:v1.0`, `sh:4`: the official client's `@object`), `{path}`, `{changeset}`, `{branch}` (a branch's, or a
  changeset's branch), `{label}`, `{shelve}` (its number), `{repository}` (`name@server`: the object's own, else the window's) and `{workspace}` (empty
  without one). A placeholder that names nothing of the object (`{label}` of a branch) is empty; an unknown `{word}`
  stays as typed.
- **The program**: `%VAR%` reads an environment variable on every OS, as the official client's did
  (`expandEnvironment`; Windows ignores the name's case). A macOS app bundle runs its own program (`appExecutable`), so
  it gets the arguments; `open -a` would hand them to a running copy as files, or drop them. A Windows `.cmd` or `.bat`
  runs through `cmd.exe`, as an editor's does (`spawnCommand`), and its arguments lose `"`, `%` and `!`, which cmd
  would read even inside quotes (a label `v1!` reaches it as `lb:v1`). Any other program starts as itself, with no
  shell, so on Windows it must be an `.exe` (or `.com`). A script for another interpreter names the interpreter as its
  program and the script first among its arguments (`powershell.exe`, then `-File C:\ci\build.ps1 {object}`). The
  official client opened such a script through its file association; one imported as it was doesn't start ("Couldn't
  run <tool>") until it's set up this way.

## Running one

Every object's menu has one "Tools ▸" (`toolsSubmenu`, menu word `tools`, group `external`) with the tools that apply
to every object selected, in the user's order, then "Manage tools…" (Settings › Tools). With no tool that applies the
submenu isn't there, so a user without tools never sees it. The menus that offer it: files and folders (Files),
pending changes on disk, a diff's and Incoming's changed files (their version: a deleted file's last one), a history's
and Browse repository's file revisions, changesets (one, or the two of a range), branches, labels and shelves, wherever each
shows (`menuGrammar.test.ts`, "the user's tools").

- **One process per object, in order** (`runTool`, `api.tools.run`), started and never waited for, in the workspace's
  folder (where the app starts without one). The first that can't start stops the rest and shows "Couldn't run
  <tool>" with the reason (`runToolOn`). Past `TOOL_RUNS_WITHOUT_ASKING` objects it asks first.
- **A revision** is saved to a temp file first (`saveRevisionToTemp`, a folder of its own each time, as "Open
  this revision" saves it), its path the object. A revision the workspace holds unchanged is copied from the disk; any
  other is one `cm cat`. Nothing else runs `cm`.
- **The repository** is the object's own (a changed file under an xlink names its xlinked repository:
  `toolSubject.version`), else the window's, as last read (`repositoryOfPlace`): building a menu or running a tool reads
  nothing to find it.
- **Only what the tool runs on**: main runs nothing when a subject is of a kind the tool wasn't set up for, and a
  revision's file name keeps only its last part (`saveRevisionToTemp`). A selection that mixes in what a tool can't run
  on (a folder in Browse repository, a deleted change) runs on the rest.

## Settings › Tools

A list of the tools, as Settings › Merge lists its rules (`toolRows`): a row edits its tool; its "…" duplicates,
orders and removes it (`toolRowMenu`). The dialog (`ToolDialog`) takes the program (typed, or "Choose…"), a name (the
program's when left empty), the arguments with the placeholders in its hint, and what it runs on (`ToolDraft`,
`toolDraftProblem`); under them, the command it would run on an example of its first target (`toolPreview`), so the
user sees what each placeholder becomes before saving.

## From the official client

On the first run (`importTools`, in `importLegacySettings`; ARCHITECTURE.md "Own config"), once:

- **`externaltools.conf`** (`readLegacyTools`) in its settings folder: one tool a line,
  `<target>[:<target>…]|<name>|<program>|<arguments>`, read as that client reads it (any case for the targets, `#`
  comments, a line not split in exactly four by `|` skipped). Its argument line is split once by the Windows rules .NET
  uses on every OS (`splitCommandLine`), and `@object`, `@repository` and `@wkpath` become `{object}`, `{repository}`
  and `{workspace}`.
- **`openwith.conf`** (`readLegacyOpenWith`), its "Open with" programs: each becomes an app the user added
  (`customEditors`, docs/features/open-with.md), by its menu name. Its shortcut isn't kept (every shortcut is the app's:
  `shortcutRegistry`), nor its arguments, which that client never passed. One the app finds at the same place shows
  once (`externalAppList`): a macOS app, or a Windows program found in its install folder. A Linux program (the app
  finds editors by their desktop entries) or a Windows editor found on the PATH by its `.cmd` launcher shows twice, the
  user's under its own name, until they remove it in Settings › Apps.

Not imported: the copy in the official client's install folder, and the one an administrator shares through the
server's global configuration, which `cm` keeps in its own config folder (`globalconfig/`) and the app doesn't read
(ARCHITECTURE.md "`cm` owns its files").
