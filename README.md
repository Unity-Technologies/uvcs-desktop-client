# Unity Version Control — Desktop

A fast, modern desktop client for Unity Version Control (Plastic SCM), built with Electron, React and TypeScript.
It has no backend of its own: every operation is a `cm` command, so it works with any server your `cm` can reach.

## Requirements

- **Node.js 22.12 or newer.**
- **Unity Version Control** installed, and signed in at least once (open the official client or run `cm` once).
  The app finds `cm` in the standard install locations and on your `PATH`; set `UVCS_CM_PATH` to use another one.

## Run it

```sh
git clone https://github.com/danipen/uvcs-desktop-client.git
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
