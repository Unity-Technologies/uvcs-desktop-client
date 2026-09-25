# Unity Version Control — Desktop

A fast, modern desktop client for Unity Version Control (Plastic SCM), built with Electron, React and TypeScript.
It has no backend of its own: every operation is a `cm` command, so it works with any server your `cm` is configured for.

## Requirements

- Unity Version Control installed, with `cm` on your `PATH` (or set `UVCS_CM_PATH`), signed in at least once.
- Node.js 22+.

## Develop

```sh
npm install
npm run dev          # app with hot reload
npm run typecheck
npm test
npm run build && npm start
```

Every `cm` command the app runs is visible in the command log (⌘⇧L). Open the command palette with ⌘K;
⌘/ lists all keyboard shortcuts.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code is organized.
