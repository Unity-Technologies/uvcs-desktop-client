# Usage events

The app records how it is used with the same events the other UVCS GUIs record, attributed to this app, so its use
can be compared with theirs. It records them through `cm`, never by itself: `cm` stores them and sends them to Unity
as it does for the other clients, with the organization and user of the workspace's server, and only for Cloud
Edition. The app holds no key, endpoint or credential for them, and reads none of `cm`'s files.

## What is recorded

- **A ping**, once an hour while a window shows a workspace: the first as soon as one shows, then every hour for the
  workspace of the window in front (`windows.shownWorkspaces`). An hour passes without one while no window shows a
  workspace, or while that workspace's shells are let go after minutes idle (`IDLE_DIRECTORY_MS`): waking two
  `cm shell`s for a workspace nobody works in costs more than the ping is worth. It says the OS version (`cm` adds it),
  the primary display's size in physical pixels (`physicalSize`) and the theme shown (`Light` or `Dark`), written as
  the other GUIs write them (`pingExtraInfo`).
- **A feature used**, when the user asks for it, before it runs and whether or not it succeeds, as the other GUIs
  count it (`UsageFeature`):
  - `checkin`: a check-in from Changes (`pendingChanges.checkin`).
  - `undo`: undoing pending changes (`pendingChanges.undo`). Undoing unchanged checkouts is a feature of its own and
    isn't recorded, nor are the undos other operations run on their way (switching with changes, shelving).

A new feature is one more `UsageFeature`, named as the other GUIs name it, recorded where the user asks for it.

## How

- **The shell names the app.** Every `cm shell` starts with `--application=UVCSDesktop` (`SHELL_ARGS`), so the events
  it sends are this app's, and with `--nopingevents`: a shell pings by itself otherwise, and the app keeps several
  open (two per workspace shown), each of which would ping. The app pings once instead.
- **`cm trackevent`** stores an event for the workspace in the current directory, and the `cm shell` that ran it sends
  it, in the background and as it exits: `cm trackevent ping --extrainfo=screenresolution=1920x1080:theme=Dark` or
  `cm trackevent featureuse checkin` (`usageEventArgs.ts`). It refuses to run in a `cm` process of its own, so it goes
  to the workspace's pooled shell, waiting for one to start (`CmRunOptions.inPooledShell`), never to a process as other
  queries do while the shells start. It prints nothing and asks the server nothing (`LOCAL_COMMANDS`).
- **Best effort** (`UsageEvents`): recording never waits for or fails what the user asked for. When `cm` refuses it,
  recording stops for the session; a shell closing under it (its window closed) doesn't stop it.
- **An older `cm`** ignores `--application` and `--nopingevents`: its shells go on pinging by themselves, one ping per
  shell, as a `cm shell` rather than as this app, and it refuses `cm trackevent`, once, after which the app records
  nothing more.
- **The services** get a `UsageRecorder` in their context: `workspaces.watch` tells it a workspace shows (which
  starts the pings), `pendingChanges` the features used. Their tests get `NO_USAGE` unless they look at usage.
