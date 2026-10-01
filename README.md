# Unity Version Control — Desktop

A fast, modern desktop client for Unity Version Control (Plastic SCM), built with Electron, React and TypeScript.
It has no backend of its own: every operation is a `cm` command, so it works with any server your `cm` can reach.

It needs **Unity Version Control** installed, and signed in at least once (open the official client or run `cm` once).
The app finds `cm` in the standard install locations and on your `PATH`; set `UVCS_CM_PATH` to use another one.

## Download

Get the installer for your OS and architecture from [Releases](https://github.com/Unity-Technologies/uvcs-desktop-client/releases/latest):
a `.dmg` for macOS, an `.exe` for Windows, an `.AppImage` for Linux. The app updates itself from new releases.

The builds aren't code-signed yet:

- **macOS** stops the first launch: open System Settings ▸ Privacy & Security and click Open Anyway.
- **Windows** SmartScreen may warn about an unknown publisher: click More info ▸ Run anyway.

## Build from source

Building needs **Node.js 22.12 or newer**.

```sh
git clone https://github.com/Unity-Technologies/uvcs-desktop-client.git
cd uvcs-desktop-client
npm install      # also downloads the Electron binary
npm run dev      # starts the app with hot reload
```

### On Linux

- Electron needs the usual desktop libraries (`libnss3`, `libgtk-3-0t64`, `libgbm1`, `libasound2t64` on
  Ubuntu 24.04; a desktop install has them).
- Chromium's sandbox helper must belong to root with the setuid bit, or Electron won't start (Ubuntu 24.04 restricts
  unprivileged user namespaces). After `npm install`:
  `sudo chown root:root node_modules/electron/dist/chrome-sandbox && sudo chmod 4755 node_modules/electron/dist/chrome-sandbox`.
- Without a display (CI, SSH), run it on a virtual one: `xvfb-run -a -s "-screen 0 1600x1000x24" npm start`.
- Workspaces are watched a folder at a time, one inotify watch each (folders `ignore.conf` names are skipped). A tree
  of more than 10,000 folders, or a full `fs.inotify.max_user_watches`, is watched in part: raise the limit with
  `sudo sysctl fs.inotify.max_user_watches=524288` (and in `/etc/sysctl.d/` to keep it).

## Other commands

| Command                      | What it does                                   |
| ---------------------------- | ---------------------------------------------- |
| `npm run build && npm start` | Builds the app into `out/` and runs that build |
| `npm run typecheck`          | Type-checks the main and renderer code         |
| `npm test`                   | Runs the unit tests                            |
| `npm run dist`               | Builds the installer for this OS into `dist/`  |

In the app, ⌘K searches everything, ⌘/ lists the keyboard shortcuts, and ⌘⇧L shows every `cm` command it ran (Ctrl on Windows and Linux).
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains how the code is organized.

## Feedback

Report a problem or ask for a feature in [Issues](https://github.com/Unity-Technologies/uvcs-desktop-client/issues) (Help ▸
Report an Issue and Request a Feature open the forms; About ▸ Copy Details gives the versions to paste in, and an
error's Details ▸ Report an Issue fills them in with the error). Report a security vulnerability
privately instead: see [SECURITY.md](SECURITY.md). [CONTRIBUTING.md](CONTRIBUTING.md) says how to send a change.

## License

[Apache License 2.0](LICENSE), copyright Unity Technologies (see [NOTICE](NOTICE)). The installed app lists the
open-source libraries it includes, with their licenses, in `THIRD_PARTY_NOTICES.txt`.

"Unity" and "Unity Version Control" are trademarks of Unity Technologies. The license grants no rights to them.
