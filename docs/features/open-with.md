# Open with

Opening files, folders and the workspace in other apps: the user's editor and terminal, any other app found, the
file manager (`main/system/apps`, `components/externalApps`). The rule that nothing opens by itself is in
ARCHITECTURE.md ("No external tool opens by itself").

## Finding apps

One way to find apps serves the editors, the terminals and the merge tools (docs/features/merge.md), GitHub Desktop's
(`app/src/lib/editors`, `app/src/lib/shells`), which asks each OS where an app is installed rather than guessing paths:

- **Identity** (`APP_IDENTITIES`, `AppIdentity`): each app is described once, however many roles it plays (VS Code is an
  editor and a merge tool): its bundle identifiers on macOS, its "Apps & features" display name and publisher on
  Windows, its desktop entry ids on Linux (the package's, the Flatpak's, the Snap's).
- **The OS's records** (`readInstalledApps`, the only processes this starts): macOS asks Spotlight once for every
  bundle identifier (`mdfind -attr kMDItemCFBundleIdentifier`, `bundleQueryArgs`, `parseBundleLocations`: copies in the
  Trash, on a disk image or translocated don't count; /Applications wins over other copies). Windows exports the
  uninstall keys (per user, per machine, 32-bit) and App Paths with `reg export`, one process per key side by side, and
  reads the files (`parseRegistryExport`): UTF-16, where `reg query` would print in the console's code page and mangle
  non-ASCII paths. Linux needs no process: desktop entries are files (`findDesktopEntry`, in `$XDG_DATA_HOME`,
  `$XDG_DATA_DIRS`, the Flatpak and Snap exports; a hidden entry, or one whose program or `TryExec` is gone, doesn't
  count). Each app is then found in those records (`locateInstall`, `programInInstall`), else where it's usually
  installed, else on the PATH (`findFirst`, `findOnPath`), as the merge tools always did.
- **When** (`InstalledAppsCache`): the records are read when first needed, shared by the merge tools and the apps list,
  and read again once older than a minute (`INSTALLED_APPS_RECHECK_MS`): an app installed meanwhile shows up without a
  restart (GitHub Desktop needs one). A failed read counts as no records and is tried again. The renderer reads the
  list at the root of every window (`useExternalApps`), stale after a minute; menus only read it as last read
  (`currentExternalApps`), so building a menu starts nothing.
- **Icons** (`AppIcons`): the apps list and the merge tools carry each app's own icon, read once per location with
  `nativeImage.createThumbnailFromPath`; a program inside a macOS bundle shows the bundle's. `app.getFileIcon` was
  tried and rejected: on macOS it draws the icon of the file type, the same for every app. A Windows `.cmd` launcher
  and a Linux desktop entry have only a file's picture, so they show none.

## The catalogs

- **Editors** (`KNOWN_EDITORS`, `findEditor`): VS Code and its forks, Zed, Sublime Text, the JetBrains IDEs, Visual
  Studio, Android Studio, Xcode, BBEdit, Nova, Notepad++, Kate, GNOME's Text Editor, gedit. Each says whether it opens a
  folder as a project (`opensFolders`): a plain text editor would open every file in it. macOS opens the bundle on the
  path (`open -a`, as Finder would); Windows runs the program in the install folder (`Code.exe`, never `code.cmd` when the
  `.exe` is there: `.cmd` launchers go through `cmd.exe`, `spawnCommand`, which drops `%` and `!` from arguments);
  Linux runs the desktop entry's command line with its file codes filled (`execArgsFor`). The user adds any program or
  macOS app ("Choose another app…", in the menus and Settings: `customEditors`); picking one already added reuses it.
- **Terminals** (`KNOWN_TERMINALS`, one finder per OS): each is told the folder its own way and started in it. macOS:
  Terminal, iTerm, Ghostty, Warp, Hyper, PowerShell by `open -a`; WezTerm, kitty and Alacritty by their own program in
  the bundle. Windows: Windows Terminal (`wt.exe -d .`), PowerShell 7, Windows PowerShell and Command Prompt through cmd's
  `start` (a console started by the app, which has none, would show nothing), Git Bash (`--cd=`). Linux: on the PATH, the
  system's choice (`x-terminal-emulator`) first. "Automatic" (`automaticTerminal`) is the terminal the app was started
  from on macOS, else Terminal; Windows Terminal, else Windows PowerShell; the system's choice, else the desktop's own.
- **Choices** (`editor`, `terminal` settings, `auto` by default): "Automatic" uses the first editor found, in the
  catalog's order; a choice no longer installed falls back to it (`externalAppList`). The editor can also be each
  file's default app (`SYSTEM_APP`): no editor, files open as the OS opens them. Settings' Apps pane picks them with
  one drop-down each (`AppPicker`, `appPickerEntries`): a list of every app found would bury the terminal under it.

## Menus

Opening in other apps is one group of every menu (`open`), first after what opens in the app (Home's "Open
workspace", a history row's "Open diff of changeset"), a separator between them (ARCHITECTURE.md "Menus"). `openOnDiskEntries` gives every item on disk the same entries (`fileMenu`,
`pendingChangeMenu`, the palette's files, `workspaceMenu`, `currentWorkspaceMenu`):

- **A file**: "Open in <editor>", what Enter and a double-click do too (`openFile`); plain "Open", its default app,
  when the user has no editor. Then "Open with ▸": every editor, the user's marked "(default)" as macOS' own Open
  With menu marks it, the file's "Default app" when an editor opens it otherwise, "Choose another app…" and "Manage
  apps…" (Settings' Apps, as the merge tools' menu leads to theirs); then "Reveal in Finder". Every "Open" says where
  it opens: a plain "Open" beside "Open with ▸" read as a second way to do the same.
- **A folder or the workspace**: "Open in <editor>" (when the user's editor opens folders) and "Open in <terminal>",
  a folder's two ways to open (its default app would only show it in Finder); then "Open with ▸" every app that opens
  folders and every terminal; then a folder's "Reveal", shown selected in its parent folder, and the workspace's "Open
  in Finder" ("Open in Explorer", "Open in file manager": `openInFileManagerLabel`, `isWorkspace`), its contents: its
  parent folder isn't the workspace's. Home's own "Open" reads "Open workspace", apart from them.
- **A revision** (history, Browse repository, a diff's files, `openRevisionEntries`): "Open this revision in <editor>"
  (plain, its default app, without an editor; a double-click in Browse repository does the same), then "Open this
  revision with ▸" as a file's. The revision is saved to a temp file first (`revisionFiles.open`), as before.
- **Words**: "Open in <app>" for a named app, "Open with ▸" for choosing one, as Finder, Explorer and VS Code say them.
- The palette ("Open workspace in <editor>", "Open workspace in <terminal>"), File's "Open in Editor" and "Open in
  Terminal", and the workspace switcher's popover open the workspace the same way.
