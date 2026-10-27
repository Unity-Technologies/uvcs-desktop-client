# Usage events

The app records how it is used with the same events the other UVCS GUIs record, attributed to this app, so its use
can be compared with theirs. It records them through `cm`, never by itself: `cm` stores them and sends them to Unity
as it does for the other clients, with the organization and user of the workspace's server, and only for Cloud
Edition. The app holds no key, endpoint or credential for them, and reads none of `cm`'s files.

## What is recorded

- **A ping**, once an hour while a window shows a workspace: the first as soon as one shows, then every hour for the
  workspace of the window in front (`windows.shownWorkspaces`), none while no window shows one. It says the OS
  version (`cm` adds it), the theme shown (`Light` or `Dark`, as the other GUIs write it) and the primary display's
  size in physical pixels (`readPingDetails`, `pingExtraInfo`).
- **A feature used**, when the user asks for it, before it runs and whether or not it succeeds, as the other GUIs
  count it (`UsageFeature`):
  - `checkin`: a check-in from Changes (`pendingChanges.checkin`).
  - `undo`: undoing pending changes (`pendingChanges.undo`). Undoing unchanged checkouts is a feature of its own and
    isn't recorded, nor are the undos other operations run on their way (switching with changes, shelving).

A new feature is one more `UsageFeature`, named as the other GUIs name it, recorded where the user asks for it.

## How

- **The shell names the app.** Every `cm shell` starts with `--application=UVCSDesktop` (`SHELL_ARGS`), so the events
  it records are this app's, and with `--nopingevents`: a shell pings by itself otherwise, and the app keeps several
  open (two per workspace shown), each of which would ping. The app pings once instead.
- **`cm trackevent`** records an event in the workspace's pooled `cm shell` (`query()`, `cwd` the workspace): `cm
  trackevent ping --extrainfo=theme=Dark:screenresolution=1920x1080` or `cm trackevent featureuse checkin`
  (`usageEventArgs.ts`). It prints nothing, only stores the event: it's local (`LOCAL_COMMANDS`), and `cm shell`
  sends what it stored in the background and as it exits.
- **Best effort** (`UsageEvents`): recording never waits for or fails what the user asked for, and the first failure
  stops it for the session. A `cm` that predates these options ignores `--application` and `--nopingevents`, and
  answers `cm trackevent` with an error: one, then nothing more.
- **The services** get a `UsageRecorder` in their context: `workspaces.watch` tells it a workspace shows (which
  starts the pings), `pendingChanges` the features used. Their tests get `NO_USAGE` unless they look at usage.
