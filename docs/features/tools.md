# Tools

Programs the user runs on what they select: a script that posts a changeset to a tracker, a build of a branch, an
upload of a file. Each one runs only when the user picks it from an object's menu (ARCHITECTURE.md "No external tool
opens by itself"). The official client calls them "external tools".

## A tool

A tool (`Tool`, `shared/domain/tools.ts`, kept in `AppSettings.tools`) has a name, a program, its arguments and what it
runs on (`TOOL_TARGETS`): files and folders (on disk, or a revision of one), changesets, branches, labels.

- **Arguments are a list**, one argument each, and never go through a shell (`toolArgs`): a placeholder fills one
  argument, so a path with spaces needs no quotes and nothing in a value is read again. Settings edits them on one line,
  as the merge tools' are (`parseArgs`, `formatArgs`).
- **Placeholders** (`TOOL_PLACEHOLDERS`, filled by `placeholderValues`): `{object}` (a full path, `cs:12`, `br:/main`,
  `lb:v1.0`: the official client's `@object`), `{path}`, `{changeset}`, `{branch}` (a branch's, or a changeset's
  branch), `{label}`, `{repository}` (`name@server`: the object's own, else the window's) and `{workspace}` (empty
  without one). A placeholder that names nothing of the object (`{label}` of a branch) is empty; an unknown `{word}`
  stays as typed.
- **The program**: `%VAR%` reads an environment variable on every OS, as the official client's did
  (`expandEnvironment`; Windows ignores the name's case). A macOS app bundle runs its own program (`appExecutable`), so
  it gets the arguments; `open -a` would hand them to a running copy as files, or drop them. A Windows `.cmd` or `.bat`
  runs through `cmd.exe`, as an editor's does (`spawnCommand`).

## Running one

Every object's menu has one "Tools ▸" (`toolsSubmenu`, menu word `tools`, group `external`) with the tools that apply
to every object selected, in the user's order, then "Manage tools…" (Settings › Tools). With no tool that applies the
submenu isn't there, so a user without tools never sees it. The menus that offer it: files and folders (Files),
pending changes on disk, a diff's and Incoming's changed files (their version: a deleted file's last one), a history's
and Browse repository's file revisions, changesets (one, or the two of a range), branches and labels, wherever each
shows (`menuGrammar.test.ts`, "the user's tools").

- **One process per object, in order** (`runTool`, `api.tools.run`), started and never waited for, in the workspace's
  folder (where the app starts without one). The first that can't start stops the rest and shows "Couldn't run
  <tool>" with the reason (`runToolOn`). Past `TOOL_RUNS_WITHOUT_ASKING` objects it asks first.
- **A revision** is saved to a temp file first (`revisionFiles.saveToTemp`, a folder of its own each time, as "Open
  this revision" saves it), its path the object. A revision the workspace holds unchanged is copied from the disk; any
  other is one `cm cat`. Nothing else runs `cm`.
- **The repository** of an object that doesn't name one is the window's, as last read (`repositoryOfPlace`): building a
  menu or running a tool reads nothing to find it.

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
  `shortcutRegistry`), nor its arguments, which that client never passed. One the app finds itself shows once
  (`externalAppList`), so importing them all loses nothing and duplicates nothing.

Not imported: the copy in the official client's install folder, and the one an administrator shares through the
server's global configuration, which `cm` keeps in its own config folder (`globalconfig/`) and the app doesn't read
(ARCHITECTURE.md "`cm` owns its files").
