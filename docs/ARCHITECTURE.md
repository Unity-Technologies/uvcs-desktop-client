# Architecture

A desktop client for Unity Version Control. The only backend is the `cm` CLI.

```
src/
  shared/     Types shared by both processes: domain model, API contract, events. No runtime deps.
  main/       Electron main process. Talks to `cm`, the file system and the OS.
  preload/    Exposes `window.uvcs` (invoke + events) to the renderer. Nothing else.
  renderer/   React UI.
```

## How a request flows

1. A component calls `api.<area>.<method>(...)` (`renderer/src/api/client.ts`), a typed proxy of `UvcsApi` (`shared/api`).
2. The preload forwards it over one IPC channel; `main/ipc/registerApi.ts` dispatches to the service.
3. Services (`main/services/<area>Service.ts`) build `cm` arguments and parse the output with helpers in `main/cm/`.
4. `CmClient` runs the command:
   - `query()` for short reads: reuses pooled `cm shell` sessions (much faster than spawning `cm`).
   - `execute()` for long or cancellable work (update, switch, checkin, merge): a dedicated process that streams progress lines.
5. Every command is logged and pushed to the renderer (`commandLogged`), shown in the command log panel.

## Parsing `cm` output

- Prefer `--xml` (`parseXml`) or `--format` with `recordFormat`/`parseRecords` (control-character separators; no ambiguity with paths or comments).
- Never parse human-readable output when a machine format exists.
- Multi-line text (comments) goes through temp files (`-commentsfile`); `cm shell` cannot take quotes or newlines in arguments.

## Renderer

```
renderer/src/
  api/          API client, query keys, event hook
  app/          Shell: screens, navigation, command palette, settings, long-running operations
  components/   Domain-aware building blocks shared by features (status badges, path labels)
  features/     One folder per area (pendingChanges, branches, merge, ...)
  lib/          Pure helpers (selection, shortcuts, dates, actions)
  ui/           Design system primitives (buttons, dialogs, menus, tables, toasts)
  styles/       Design tokens and global CSS
```

- **Data**: TanStack Query. Every workspace query key starts with `queryKeys.inWorkspace(path, ...)`, so `invalidateWorkspace(path)` refreshes everything after an operation.
- **Mutations**: `runOperation` (progress toast, cancel, refresh) for long operations; `runAction` for quick ones. Both report errors as toasts.
- **Navigation**: a view per sidebar entry (`app/navigation/viewRegistry.ts`) and a stack of drill-down pages (`app/navigation/pages.ts`) such as history, diff or merge.
- **Actions**: menus and the command palette share the `Action`/`MenuEntry` model (`lib/actions.ts`). Register palette commands (and their shortcuts) with `useCommands`.
- **Dialogs**: `openDialog`/`askDialog`, `confirm`, `prompt` — callable from anywhere, no local state plumbing.
- **Styling**: CSS modules using the tokens in `styles/tokens.css`. No raw colors in components.

## Conventions

- Names reveal intent; small files; one component or concept per file.
- No dead code, no speculative abstractions, no duplicated logic.
- Pure logic gets a `*.test.ts` next to it (`npm test`).
- `npm run typecheck` must pass.
- To see the app: `npm run build && node scripts/screenshot.mjs /tmp/shot.png open:<workspace path> key:Meta+3`.
