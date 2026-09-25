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

## Other commands

| Command                      | What it does                                   |
| ---------------------------- | ---------------------------------------------- |
| `npm run build && npm start` | Builds the app into `out/` and runs that build |
| `npm run typecheck`          | Type-checks the main and renderer code         |
| `npm test`                   | Runs the unit tests                            |

In the app, ⌘K searches everything, ⌘/ lists the keyboard shortcuts, and ⌘⇧L shows every `cm` command it ran (Ctrl on Windows and Linux).
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains how the code is organized.
