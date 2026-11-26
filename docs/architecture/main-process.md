# The main process: errors, logs, operations, windows and start-up

How the main process tells errors, keeps its log, reports operations, opens and closes windows and starts. The
summary every change respects is in `docs/ARCHITECTURE.md`.

## Errors

Every error is the app's to tell, in its own UI; Electron's native "A JavaScript error occurred in the main process"
dialog never shows.

- **Expected failures** reach the window as the API call's rejection (`registerApi`: a `CmError` keeps its command,
  clipped as the command log clips it, both ends of its output kept: `clipForLog`), and the renderer tells them as
  error toasts (`runOperation`, `runAction`) whose Details open `ErrorDialog`, with "Report an Issue".
- **Main, nothing caught**: `main/index.ts` imports `errors/installUnexpectedErrorHandlers` first, so before any other
  module runs `handleUnexpectedErrors` listens to `uncaughtException` and `unhandledRejection` (a listener of the app's
  own is what keeps Electron's dialog away, and Node from ending the process on a rejection). Each one is logged to the
  console with its stack, secrets hidden (`textForLog`), and, once per message, written to the log file ("The log
  file") and sent to every window (`unexpectedError`). The app keeps
  running. Node warns that state may be inconsistent after an uncaught exception, but here the state that matters lives
  in `cm`, the disk and the settings file (written whole, `replaceFileSync`), and quitting would lose what the windows
  hold (unsaved edits, running operations) for no gain. Code that runs from callbacks, where no promise catches a throw,
  ends cleanly itself: `CmShellSession.guarded` wraps its stream listeners and timers, and a throw there (or a broken
  stdin pipe) fails the running command and starts a new process, as a stalled prompt does.
- **The window, nothing caught**: `reportUnexpectedErrors` (called first in `main.tsx`) turns the main process's
  `unexpectedError` and the page's own `error` and `unhandledrejection` events into one error toast per message,
  "Something went wrong", with "Report an Issue" (`unexpectedErrorIssueUrl`: the app's details and the stack, reviewed
  in the browser before sending). The stack never shows on screen. A render error shows `AppErrorBoundary`'s
  `WindowErrorScreen` (Reload, Report an Issue) instead of a blank window: one boundary around the screen, inside the
  dialogs and toasts so they keep working, and one around the whole app as the last resort.
- **A toast reads as text, never a scroll box**: its detail (an error's message, often a URL or a path) shows its first
  three lines and a "Show more" when it hides the rest (`detailToggleOf`, measured by `useClippedText`); unfolded, it
  shows whole and the toast stays until dismissed (`autoDismissMsOf`). The action sits under the text, so the message
  has the card's whole width (`ToastCard`). An error toast's Copy puts its title and message on the clipboard
  (`errorCopyTextOf`).
- `unexpectedErrors.test.ts` checks that the handlers are main's first import, installed in one place, and that every
  timer of `CmShellSession` goes through `guarded`.

## The log file

What a user sends with a bug report: the windows' command logs end with the session, so main keeps one log file,
`uvcs-desktop.log` (`appLog`, `main/diagnostics/`), in the OS's logs folder for the app (`app.getPath('logs')`:
`~/Library/Logs/<app>` on macOS, `logs` in the user data folder on Windows and Linux). An app run from the repository
logs in `logs` in its user data folder on every OS, so the smoke test's temp folder holds its log. Help ▸ Show Log
Files shows it in the file manager (`showLogFiles`; the folder while there is no file), and the bug report form asks
for it (`.github/ISSUE_TEMPLATE/bug_report.yml`, `log-file`). It never leaves the device by itself.

- **What it holds**, one timed record each (`logRecord`: local time and offset from UTC, as `cm`'s own log, so the two
  read side by side; later lines indented): the launch (app version, OS, architecture, Electron: `startedText`), the
  `cm` that answered (`cmFoundText`, written by `system.cmVersion`, which already runs `cm version`: no command of its
  own), every command-log entry (`commandText`: its line, folder and time; how a failure ended, `entryEnding`, and the
  output the command log kept), errors nothing caught in main (`handleUnexpectedErrors`' `record`) and in a window
  (`system.logUnexpectedError`, `unexpectedErrorTeller`; a render error with its components, `renderError`), each
  once per message as it's told, so one that repeats doesn't rotate away what led to it,
  pages and processes that ended unexpectedly and windows that stop responding (`logAppHealth`), and failed updates.
- **What it doesn't**: levels, categories or tracing. A new record is an event a bug report needs, written with
  `DiagnosticWriter.write`; anything that repeats per item, frame or keystroke stays out.
- **Secrets**: every record goes through `textForLog` ("Secrets"); the command lines are already hidden as the command
  log shows them.
- **Never in the way**: records wait in memory while one append runs, and go together in the next (`DiagnosticLog`);
  a failure loses them quietly, and the log never logs its own failures nor throws at its caller. Records still
  waiting when the app quits or main crashes are lost: writing each one synchronously would stall the main process.
- **Size**: a record keeps at most `MAX_RECORD_LENGTH` characters, its start and its end (`clipForLog`), whoever sent
  it. Past 5 MB the file becomes `uvcs-desktop.1.log`, that one `.2.log`, and the oldest is dropped
  (`rotationRenames`): about 15 MB at most. A file that can't move (held open by a viewer or an antivirus on Windows)
  takes the records and is moved on a later write; a rename that fails stops the rotation, so no earlier file is
  overwritten.
- **No crash dumps**: Electron's `crashReporter` stays off. A minidump holds the process's memory, where a password or
  a token can be, and reading one needs symbols and tools no user has; the log's `render-process-gone` and
  `child-process-gone` records tell that a process crashed and why.

## Profile pictures (Gravatar)

People show as their initials (`initials`: the first letters of the first two words of the name, or the first two
letters of a one-word name, as the other UVCS clients show them) on their own color (`ui/Avatar`, `avatarColorOf`)
until the user chooses to see their Gravatar pictures. Nothing goes to gravatar.com before that choice: it's a hash of
each email address shown, and the user decides whether it leaves the machine.

- **Off until chosen**: `showGravatar` and `gravatarChoiceAsked` both start false (`shared/domain/gravatarChoice.ts`).
  Pictures show only when both are true (`showsGravatar`), checked in one place, the main process's `system.gravatar`
  (`systemService`), which alone fetches (`GravatarCache`, `net.fetch`); the renderer only follows it
  (`useGravatarSetting`, `setAvatarPictureSource`). Only users named by an email address are ever looked up
  (`isEmailAddress`).
- **Asked once, when people show**: the first avatar of someone named by an email address marks people as shown in
  the window (`notePersonShown`, from `avatarImageFor`); the user's own account (the top bar, the account menu,
  Settings' accounts, Home's account switcher, `ownAccount`) doesn't, so the question never comes at launch with only the user on screen. Then
  a card in the toast corner (`GravatarPrompt` on `CornerCard`, `asksAboutGravatar`) asks "Show profile pictures?"
  with "Show pictures" and "Not now". While a dialog opened with `openDialog` or `askDialog` is open (`useDialogStore`:
  Settings, About, confirmations...; the command palette isn't one) it waits, so it never sits over the dialog's
  buttons, and shows again once the dialog closes. It has no close button and doesn't time out, as the question needs
  an answer: either one is saved with `gravatarChoiceAsked` (`gravatarChoice`), and it never asks again, in this
  window or another. Quitting without answering keeps pictures off and asks again the next time people show.
- **Settings › Appearance › People** turns pictures on or off at any time; that's a choice too (`gravatarChoice`).
- **Settings saved before the question existed** hold `showGravatar` without `gravatarChoiceAsked`, written with every
  other setting while pictures were on by default (`storedGravatarChoice`, read by `SettingsStore`): `true` may be
  only that default, which the user never chose, so pictures are off until asked; `false` can only be the user's own
  choice, kept as answered, so they aren't asked again.

## Operation progress

Long operations report a structured `OperationProgress` (`shared/domain/operation.ts`): a stage (`preparing`,
`calculating`, `downloading`, `uploading`, `applying`, `confirming`, `finishing`, or `working` in the app's words),
stable stage words, files and bytes done and to do, a fraction (or null), the file at hand, whether stopping is still
safe, and the step of a multi-command operation (shelve, undo, switch, bring). Never a raw `cm` line.

- Each command's output is read by a pure `ProgressReader` (`main/cm/progress/`), passed as
  `onOutputLine: context.progressOf(reader)`; the operation's `ProgressReport` (made by the `OperationTracker`) adds the
  step (`context.beginStep`) and throttles to ten reports a second, stage changes at once.
- `cm update`/`cm switch` run with `--forcedetailedprogress` (`updateCommand`, `switchCommand` in `cm/updateArgs.ts`):
  `cm` prints its bytes-and-files line only to a terminal otherwise, and `--machinereadable` turns it off. That line is
  rewritten with `\r` every 200 ms, so `runCmProcess` splits lines at `\r` too. The words are localized: readers go by
  the line's shape. Its percentage goes by bytes and it writes big files first (99% with 1 of 8,001 files written), so
  the fraction weighs each file as 128 KB more than its bytes; where the percentage shows beside one measure, the other
  is at hand (card, tooltip). In a partial workspace the commands are `cm partial update`/`cm partial switch`, which
  refuse `--forcedetailedprogress` and always print a line of their own, a new one every second
  (`readPartialUpdateProgress`).
- `cm checkin --machinereadable` reports uploaded bytes only every 5 s with redirected output; `cm merge` prints its plan,
  then a record per change applied in a burst, then downloads silently; `cm shelveset create` only names its stages.
- Stopping is offered only while it leaves things as they were: a killed update or switch leaves the workspace half
  updated with partial files as private `.private.0` copies, and a checkin killed while confirming may be half recorded;
  killed while uploading, nothing is committed.
- The renderer keeps each operation's progress and its bar motion (`runningOperationsStore`, `progressBar`): the bar
  glides linearly towards where the next report should land at the current pace (never backwards, at most halfway into
  what's left), sweeps while nothing is measured, and stays full and shimmering while wrapping up, all of it moved
  by transforms on the compositor. `OperationCard` draws it in fixed rows and widths, then turns into the success
  message in place; the status bar, the branch pill (a switch) and the incoming chip (an update) show the same
  operation with a `ProgressRing`. A report renders only these (`useRunningOperationOfKind` for the pill and the chip).
- The app's icon shows every operation that changes a workspace (`OperationTracker.run`), with no code of its own in
  any feature: `trackOperations` hands each start and report to `AppIconProgress`, which draws them through
  `BrowserWindow.setProgressBar` (`showProgressOnAppIcon`; the rules in `main/window/iconProgress.ts`). The icon shows
  the whole operation, the steps before the current one done (`operationIconProgress`), and never goes back while it
  runs: a bar that fills, empties for the next step and fills again reads as done and started over. Windows gives
  each window its own taskbar button, which shows that window's operations: a pulse until they're measured, then the
  fraction, and red for one that failed while its window was in the background, until the user comes back to it. The
  macOS Dock and Linux's launcher have one icon for the whole app, which shows every window's operations together,
  only once measured: the Dock draws Electron's indeterminate value as a full bar, which reads as done, and neither has
  a red bar. The Dock keeps a bar after its window is gone, so the last window clears it as it starts closing
  (`windowClosing`), and sets it again if its page holds the close back. On Linux Electron sets the bar through the
  LauncherEntry D-Bus API, which Ubuntu's dock and KDE Plasma's task manager show (plain GNOME Shell shows nothing),
  and only for an app whose `.desktop` file is installed under Electron's name for it: package.json's `desktopName`,
  which `linux.syncDesktopName` gives the file (`scripts/build/linuxDesktopName.test.ts`). A bare AppImage installs no
  `.desktop` file, and integrators that rename it (`appimagekit_…`) break the match. The same name is the windows'
  `WM_CLASS` and Wayland `app_id`, so the windows group under their launcher entry. A badge count was left out on
  purpose: the sidebar's badges (incoming, pending changes) already count, and one more on the icon would compete.

## Windows

One window per workspace, so several tasks (often one AI agent each, in its own workspace and branch) run side by side.
A workspace window may open page windows (a diff, a history… in a window of its own, for another display), which
belong to it and aren't workspace windows: `features/page-windows.md`.

- `main/window/WorkspaceWindows` opens the windows; opening a workspace that another window shows brings that window
  forward instead (`windows.focusPlace`, checked by `useOpenWorkspace`). The windows open as the installed app quits
  (`saveSession`, from `Quitting`: each one's workspace or home screen, bounds, maximized and full screen, the last
  focused one last; `openWindows`) open again at its next launch where they were (`openFirst`, `windowsToReopen`: one
  per workspace, none for a folder that's gone), the focused one in front and the others shown behind it
  (`showInactive`). A repository explored without a workspace is saved with its GUID when a listing taught it, and its
  window, opened at once on the saved name, is asked to open the name a rename made elsewhere gave it (`followRename`),
  unless the user took it elsewhere meanwhile. After a restart to install an update, which nobody chose, each also
  opens on the view it showed (`Quitting.restartToInstall` saves `withViews`; the page reports each view it goes to,
  `windows.viewShown`, and reads it back from its address, `startingViewIn`); a launch of the user's own starts on
  Changes. Where the app quits as
  its last window closes (Windows, Linux), that window is saved as it closes (`Quitting.lastWindowClosing`). With none
  saved (on macOS, every window was closed before quitting), the first window reopens the last workspace used. Development builds start on one home screen, where automated UI checks pick a workspace. A new
  window opens on the home screen. A new window asked to open a workspace
  takes it at start (`system.takeRequestedPlace`), as does a folder the installed app is launched with on Windows
  and Linux (`workspaceArgument`; a second launch hands it to the running app). A launch for a `uvcs://` link names no
  folder: the link goes to the window in front once the first windows opened (`receiveLinks`,
  features/deep-links.md). The first window waits until `cm` has
  found the workspace holding that folder (`handleLaunchRequests`), which may take longer than Electron takes to start.
  The Window menu lists them; closing the last one keeps the app on macOS, and the Dock icon opens the home screen (its
  menu offers New Window under the recent workspaces, `installDockMenu`); elsewhere it quits.
- A window that leaves one workspace for another keeps its page: `WorkspaceGate` mounts the views again, but the
  renderer's stores outlive the workspace. A store holding a workspace's state keys it by the workspace path
  (`useExpandedDirectories`, `useViewSelection`) or says which workspace it belongs to (`cutItemsIn`,
  `revealRequestIn`); otherwise the next workspace reads it, e.g. lists a folder only the last one has. The big part
  of what the window read of the workspace it leaves (for another one or the home screen) goes once its views unmount
  (`useForgetLeftPlace`, `forgetPlace`): what nothing shows of its immutable results (revisions, what
  changesets changed) and of every content its diffs read, its own files too (`content`, `contentBytes`,
  `diffContents`, whatever their source). Each window has its own query client, and a workspace's revisions, kept an
  hour, held hundreds of MB after the window moved on. Its lists and info are light and stay until their usual
  `gcTime`, so coming back within minutes asks the server nothing; only a content shown again is read again.
- The start-up (`main/index.ts`) is a few named steps; the wiring behind each (settings, watchers, own writes,
  operations, launch requests, the first window) lives in `main/startup/`, around the tested logic of the other
  folders. The order and what it waits for: "Start-up" below.
- Each API call runs with its window as the caller (`main/ipc/caller.ts`, followed across `await`s), so its commands
  (`commandLogged`) and operation progress go back to that window only. `workspaces.watch` is the window saying which
  workspace it shows: `main/watch/WorkspaceWatchers` keeps one watcher per shown workspace and sends its changes to the
  windows showing it; own writes are ignored in the workspace they touch.
- Quitting goes through one `before-quit` listener (`main/startup/quitting.ts`, `Quitting`). An operation changing a
  workspace (`OperationTracker.writesRunning`: update, switch, checkin, merge…) holds the quit back, as quitting would
  kill its `cm` partway: the OS's message box asks to quit once it finishes or to stay (`askToQuitWhenDone`), and with
  no window left (Windows and Linux quit as the last one closes) the app quits once it finishes. A slow read never holds
  it. Then the pages hear it (`quitStarted`), so one with unsaved edits asks Save / Don't save / Cancel first.
- Closing a window holds back the same way, on every OS, while an operation changing a workspace that it (or a page
  window it owns, `WorkspaceWindows.closingWith`) started runs (`ClosingWithWrites`, from `WindowWrites`, which
  `trackOperations` fills with each write's window): closing would hide the operation while it runs, and where the
  app quits with its last window, leave it running with no window at all. The OS's message box asks, over the window
  brought forward, to close it once the operation finishes or to keep it (`askToCloseWhenDone`); other windows'
  operations never hold it. Its `close` listener comes before the window's others, which check
  `event.defaultPrevented`: a held close neither saves the session as the last window nor reaches the page's
  unsaved edits, and the app's icon takes the window back (`windowKept`). Closing again while it waits asks nothing
  more. There is no "Close now anyway": the operation would keep running out of sight (on Windows and Linux with no
  window at all), and its card already offers Stop where stopping is safe. Once the app is quitting (`Quitting.started`)
  nothing is held: quitting went on only after the operations finished, and a window's question must not veto the app's
  own close (a quit a page cancels for unsaved edits is no quit anymore, and holds again). The `close` listener that
  holds is the window's first (`createMainWindow`'s `onCloseRequested`), so the saved bounds also skip a held close. A
  page window its workspace window left behind (the window shows another workspace) is closed by the app, not the
  user: it asks nothing and stays open while its own operation runs, then closes (`ClosingWithWrites.closeLeftBehind`).
- Settings are written in main, one change at a time; values computed from the stored ones (the recent workspaces and
  branches) are computed there too, and every window gets the result (`settingsChanged`).
- What a window checks as it opens runs until it succeeds once; later windows take that answer (`untilSucceeded`), and
  a problem is checked again by the next window, and by Retry. `cm version` says `cm` runs (`CmUnavailableScreen`
  otherwise); `cm profile list`, a local command, says it's configured (`checkSetup`): without a configuration every
  command but `version`, `location`, `configure` and `help` fails at once saying so, and `SetupProblemScreen` takes the
  app's place. The check costs no command of its own: the profiles, the accounts they make, the servers and it share one profiles read
  (`ProfileList`: everyone asking while it runs takes its answer, a removed account makes it `forget` a read started
  before, and once one succeeded `cm` is configured for the session). Unconfigured, that read runs as a process:
  `cm shell` refuses to start, so no session is ever ready. No server is asked at start-up: the home screen works
  without any. The server of the window's place is checked as
  it opens and as the window comes forward, `cm checkconnection <server>` (`accounts.checkSession`,
  `useWindowSessionCheck`; at most once every ten minutes per server app-wide, docs/features/accounts.md "Keeping
  sessions alive"): a workspace's once its info names it, a repository's explored without one from its spec
  (`serverOfPlace`). A server out of reach shows in a corner card naming it (`ConnectionProblemCard`,
  `connectionProblemShown`), while a workspace works with what's local; one that needs a sign-in covers the window with
  the sign-in screen (`SignInCover`). Checking the default
  server at start-up, and stopping the app on its failure, was dropped: it left a user offline unable to open even the
  home screen, and named no server, as `cm checkconnection` prints none.
- Dropping a folder on any window, home screen or workspace, opens its workspace in that window, or with Shift in a
  new one (`app/folderDrop`, as the official client does). The decision is `workspaces.findRoot`, a local
  `cm getworkspacefrompath`, so a folder inside a workspace opens it too; a folder that is no workspace goes straight to
  the new workspace dialog with its location filled in, and the repository and workspace named after the folder
  (`initialRepositoryName`; a folder picked with Open workspace folder… asks first: `openFolder`).
  Only a single folder is taken; drops wait while a dialog is open. Chromium hides a drag's files from the page until
  the drop, so the overlay's words come from main (`system.draggedFolder`, asked once per drag): on macOS it reads the
  drag pasteboard with `osascript` (`readDraggedPath`, about 60 ms) and looks for `.plastic` in the folder or above it
  (`describeDraggedFolder`, no `cm`), and the overlay says "Open workspace" or "Create workspace"
  (`dropOverlayWording`). Windows and Linux have no pasteboard a process can read during a drag, so there, and until
  the answer comes, it says "Open or create a workspace". The words are a guess: the drop decides on the dropped path.
  The drag is followed on `window` by `nextFolderDragState` (enters minus leaves,
  ended for sure by a `dragleave` towards nothing, a drop or any pointer move), since an element's own
  enter and leave events don't pair up and left the overlay on screen.
  The overlay (`FolderDropOverlay`) fades out on a timer (`LEAVE_MS`), never on an animation event, so it can't linger.
- A workspace picked from a list (the home screen's rows, search and a repository's Open button, the switcher, the
  palette's workspace results) opens in this window, or in a new one with Shift held on the click or Enter
  (`windowAskedBy`, `workspaceOpener`; `workspaceInNewWindow` in the shortcuts sheet, the switcher's hints and the
  menu's key cap), the modifier a folder drop takes, and the one browsers use for a new window on all three OSs.
  With another modifier held too it opens here, and a missing workspace always opens here, whatever the keys: its
  screen locates, recreates or forgets it. The menu says the same: Open workspace, then Open in new window
  (`workspaceMenu`), but not a missing workspace's. The new window asks `windows.openPlace`, so a workspace another
  window shows comes forward instead; the new window remembers it as recent as it opens it (`useRequestedPlace`).
- A new workspace (the New workspace dialog: `createWorkspaceAndUpdate`) opens as soon as `cm workspace create` makes
  it, then gets the latest files of /main through the workspace's own Update (`updateWorkspace`: `cm update` in a process
  of its own, its progress card, its refreshes). `cm workspace create` already puts it on /main with nothing loaded, so
  there is no switch. A failed update leaves the workspace created and open, reported as any failed update. Recreating a
  missing workspace downloads its files the same way; a new repository's workspace isn't updated: it has nothing yet.
  On Windows, where the UVCS tray runs (its file system mounts dynamic workspaces), the dialog offers to make the
  workspace dynamic (`workspaces.canCreateDynamic`, which lists local processes with `tasklist`: never a server, and
  never `cm`'s own files; `newWorkspaceFormOf`'s `offersDynamic`). A dynamic one is created with `cm workspace create
  --dynamic --tree=br:/main@<repository>` (`workspaceCreateArgs`) in a process of its own, as it waits for the mount,
  and opens without an Update: its files download as they're first opened.
  The New workspace dialog can create its repository too: its Repository field is editable, suggesting the server's
  repositories (`ui/Combobox`: lists.md "Big lists render only the rows in view"); a name the server has is that repository,
  any other (by case, as `cm` tells them apart) is created with the workspace (`newWorkspaceFormOf`,
  `createNewWorkspace`). As a slip would create a repository on a shared server, the button then says "Create
  repository and workspace", and a name that differs from a repository's only by case names it
  (`repositoryNamedButForCase`). It creates with the same steps as the New repository dialog's workspace
  (`createNewRepository`): `cm repository create`, then `cm workspace create`, and no update. A workspace that fails
  after its repository was made keeps it: trying again creates only the workspace (`createRepositoryWithWorkspace`).
- "New workspace for a task" (`features/taskWorkspace`) creates a child of /main at its head (or takes an existing branch),
  a workspace next to the current one, and switches it (a plain `cm switch`: it's empty); a failure removes the new
  workspace and keeps the branch. The switcher shows the branch and pending changes of the other workspaces of the same
  repository with one local `cm status` each, only while it's open (`workspaces.glance`).
- A workspace reads the same everywhere it shows (the home screen, the switcher, the top bar's workspace pill): the
  repository's avatar (`components/RepositoryAvatar`: a white initial on a solid `--avatar-*` fill, picked by
  `avatarColor` from the repository's short name, the workspace's own until it's known; a neutral square while
  loading), then its branch (`SelectorChip`) and server (`ServerChip`, the whole `name@server`
  in its tooltip), told by `useDescribeWorkspace` (a local `cm wi` of each, `workspaceHeadsReader`; `cm status` only for recent ones it can't tell). A
  partial or dynamic workspace also shows its kind as a chip, with what it means in its tooltip (`WorkspaceKindChip`,
  `workspaceKindChip`), and as a badge in its avatar's corner, a bolt or a half-filled circle in the accent color on a
  raised disc, so the avatar itself tells it (`WorkspaceKindBadge`; both mark the kinds
  `markedWorkspaceKind` names, and a missing workspace's neither: `shownWorkspaceKind`); a standard one, the way most
  are, shows none, and its details' Type line says it (`workspaceKindWords`). In the switcher's narrow rows the server
  gives way first, down to its icon, then the branch's name.

## Start-up

What a launch does, in order (measure it with `scripts/perf/startup.mjs`; `--timeline` shows what waits for what):

1. The main process's entry (`main/boot.ts`, package.json's `main`) turns Node's compile cache on, in the user data
   folder (`compile-cache`), then loads the app's bundle (`main/index.ts`), which V8 then compiles from what the
   previous launch cached: 5-10 ms sooner. It works from inside app.asar (Node reads the source through Electron's
   file system and keys each entry by its path and content), and the cache is skipped when it can't be used.
2. The main module opens the settings (the first run imports the official client's, `importLegacySettings`: a few
   ms), wires the services and, as it loads, before Electron is ready (`cm` needs neither that nor a window), starts
   the `cm shell`s of the workspace the first window reopens (or of the home folder, for the home screen) and that
   screen's first reads (`readFirstScreenAhead`, `readFirstScreen`): `cm version` and the workspace's info and
   pending changes, or the home screen's workspaces, servers and profiles (the last two one `cm profile list`). Their commands run while Electron gets ready (50-60
   ms) and the window and its page load; the page's identical calls take the answers (`EarlyCalls`, in
   `registerApi`; one nobody takes goes 5 s after the window opened, `EARLY_ANSWER_MS`, `expireUntaken`). A launch
   that names a folder on Windows and Linux (`launchNamesAFolder`, known as the module loads) reads ahead only
   `cm version`: its workspace, which `cm` finds, is read as the window opens (`openFirstWindow`). macOS names it later
   (`open-file`), so there the last workspace is read ahead anyway, and those answers expire unused (its shells, shown
   only while it opens, go after `OPENING_SHOW_MS` as no window watches it: `showWhileOpening`). A failed read
   ahead only means the window reads its screen as it opens. At `app.whenReady` the main process registers the API
   and opens the first window, and builds the menu bar right after creating it, before it shows. What `cm` logs
   before the window exists waits for it (`CommandLogRelay`), and the page's events sent while it still loads reach
   it once it has (`sendEventTo`), so its command log lists them.
3. The window is created hidden, its background the page's `--bg-app` (`WINDOW_BACKGROUND`), and names the place it
   opens in its page's address: a workspace when the folder is there, a repository explored without one
   (`startingPlaceQuery`).
4. The page opens that place (`openPlaceFromAddress`) and asks for its first screen's data
   (`prefetchStartupQueries`) before its first render, and applies the theme as it renders (`useTheme`): its first
   frame is the themed workspace screen or home screen, never the home screen on the way nor a frame without colors.
   The window shows on that frame (`ready-to-show`): the first render is synchronous (`flushSync` in `main.tsx`,
   `firstRender.test.ts`), as React otherwise commits a root on a later task, after the page's first frame in most
   launches, and the window showed its background alone. Every view and page is in the startup bundle, the heavy
   libraries out of it (renderer.md "One layout from the first frame"): the bundle grows from 1.9 to 2.7 MB, the
   page's scripts run and the window shows 2-26 ms later (about 15), and Changes shows its data 6-70 ms sooner (about
   30), as it waits for no chunk (`scripts/perf/startup.mjs`, fake and real `cm`, warm and cold, interleaved against
   lazy views and pages).
5. `show()` holds the main process 35-55 ms (100+ when started from a terminal, which isn't the active app): what the
   page asks after its first paint waits behind it. That is why the page asks before rendering, and the main process
   earlier still.
6. The one thing that gates it: the app's own `cm` not set up yet (the first run, or an update whose `cm` didn't
   download ahead). Then nothing is read ahead, and the window starts on the setup screen (docs/features/cm-runtime.md
   "The setup screen"); a launch with it there checks one folder exists, nothing more. An installed `cm` older than the pinned version is
   caught by the first window's `cm version` instead, which then shows the update screen (cm-runtime.md "The update
   screen"). A folder named at launch opens
   once it's set up (`CmRuntime.whenReady`).
7. Nothing else gates the first screen: `cm version`'s answer (the app shows meanwhile, `CmUnavailableScreen` only on
   failure), the local setup check once `cm` runs (`useSetupCheck`), the workspace's server check
   (`useWindowSessionCheck`), the watcher once the page watches, the highlighter warm-up 1.5 s later (`main.tsx`),
   avatars when rows show them, the menu bar (built by the first window opening, then once per burst of window
   changes: `appMenuInstaller`), the top bar's merge request (one `cm find review` of the workspace's branch, asked
   once the pending changes are read: `asksForBranchReviews`).

Reopening the last workspace on an M4 Max (Electron 44), started as the Dock does, warm, median of 14 runs, in ms
after the process starts, interleaved with a build from before the compile cache, the reads before `app.whenReady`,
the lazy updater and the synchronous first render (in brackets; two sessions): with the real `cm` on a local sandbox
the first paint comes at about 350 (360-386) and Changes shows its data at 425-530 (535-620); with the fake `cm` the
first paint and the data come within noise of before (about 350 and 370), as the fake answers before the page asks.
What remains: Electron's own start to `app.whenReady` (about 140), creating the window (about 45), loading the page
(about 105 to its first render, which its scripts include), and `cm status` as a process (300-350: the workspace's
shells answer only after about a second).

Tried and dropped, so they aren't proposed again:
- Showing the window as it is created (`show: true`): an empty frame shows 150 ms sooner, but `show()` then holds the
  main process while the page loads, which ran its scripts 150 ms later.
- Asking the main process which workspace to open (`takeRequestedPlace`), or awaiting the settings, before the
  first render: the wait paints an empty frame, the window shows on it, and `show()` holds the answer: the first
  render came 90 ms later.
- Minifying the renderer bundle (1.7 MB to 0.73 MB): the page's scripts ran 0-8 ms sooner, within noise.
- Serving the renderer from a custom `app://` scheme with V8's code cache (`codeCache: true`): deserializing the
  cache (12 ms on the page's main thread) replaced the compile Chromium streams off it, and the protocol handler cost
  10 ms more: Changes showed its data at 375, 381 and 378 ms over `file://`, the scheme, and the scheme with the cache.
- Preloading the Changes view's chunk before the first render, when views loaded lazily: 10 ms sooner with the fake
  `cm` only; with the real one `cm status` answers later and hides it. Bundling the views (step 4) was chosen for
  their first frame, not for the time.
