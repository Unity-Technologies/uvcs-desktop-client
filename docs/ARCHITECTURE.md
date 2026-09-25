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

## No external tools, ever

The app never lets `cm` open its merge or diff tool; every conflict is resolved in the app's merge page.

- `cm merge --merge` always carries `--nointeractiveresolution` and an explicit decision for every conflicting file
  (`fileConflictArgs`): workspace merges keep the destination and the app writes the resolutions; merges into a
  server branch keep one side for all files.
- Shelves are applied as merges from `sh:N` (never `cm shelveset apply`); `cm update` keeps `--dontmerge`;
  `cm diff` always has `--format`. `main/cm/noExternalUi.test.ts` checks these statically.
- `cm` processes run with stdin closed, so a console prompt fails instead of hanging.

## Switching with pending changes

`cm switch` only ever runs on a clean workspace (`main/workspace/switchWithChanges.ts`), whatever client.conf's
`PendingChangesOnSwitchAction` says. The renderer's single entry point is `switchWorkspace`
(`app/shell/workspaceOperations.ts`): preflight, then ask (or follow the setting) whether to leave the changes or
bring them along. The main process shelves them with the official automatic-shelve comment, checks the shelve holds
them all, records it in the settings (`switchShelves`), undoes, moves added files aside (leave), switches, and
merges the shelve on the target (bring). Failures put the changes back. Left shelves (the app's and the official
client's) are offered again by the "Welcome back" banner in Changes (`features/leftChanges`), or restored
automatically on arrival when they apply cleanly.

## Two developers on one branch

- `cm` rejects every checkin once the branch head moved ("A merge is needed from changeset…"), even without overlapping
  files. `checkinChanges` recognizes it (`checkinRejection`) and asks (`CheckinRejectedDialog`): when what came in touches
  none of the files and needs no merge, it updates (the guarded update) and checks in again with the same files and comment;
  otherwise it leads to Incoming, and Changes offers to check in once the workspace updated past the rejection.
- An update stopped by colliding local changes (`--dontmerge`) shows a toast leading to Incoming (`explainUpdateConflicts`).
- Local changes to files the branch deleted or moved block the update. `shelveBlockedAndUpdate` shelves just those files
  as a switch shelve record (`reason: 'update'`), undoes them and updates; the "Welcome back" banner offers them back.

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
- **Refresh**: views refresh themselves when something changes, never on a timer except the incoming check.
  - `main/watch/WorkspaceWatcher` watches the open workspace (recursive on macOS/Windows; the root and `.plastic` only on Linux),
    skips `ignore.conf` folders and `.plastic` lock/temp files, coalesces bursts (300 ms quiet, 2 s max wait) and drops what the
    app's own writes cause (`changesWorkspace` commands and tracked operations): the renderer refreshes after those anyway.
  - `workspaceChanged` tells file edits (pending changes, review marks, files view, open diffs of workspace files; if auto refresh is on)
    from `.plastic` rewrites by any tool (workspace info; everything when the loaded changeset or branch moved). See
    `app/shell/useWorkspaceWatcher.ts` and `app/refresh/`. A diff being edited holds still and offers to reload instead.
  - Locks live on the server, where nothing reports changes: pending changes re-read them along with the changes, at most every 30 s.
  - Window focus (wired to real focus in `trackWindowFocus`) refetches stale server views; local views skip it while the watcher sees everything.
  - Incoming: `useIncomingSummary` polls every minute with focus, every five minutes behind other apps, never hidden, and on focus if
    older than 20 s. A branch head moved by someone else refreshes the repository views.
  - Use `refreshQueries` for event-driven refreshes: it never cancels a fetch in flight, it queues one follow-up.
- **Review marks**: `main/review/ReviewStore` keeps, per workspace, the fingerprint of each file marked reviewed (and a copy of its text,
  read as the `reviewSnapshot` content source) under `<userData>/review-snapshots/`; marks of paths that leave the pending changes are dropped.
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
- To see the app, either:
  - scripted: `npm run build && node scripts/screenshot.mjs /tmp/shot.png open:<workspace path> key:Meta+3`, or
  - interactive: `npm run build && UVCS_CDP_PORT=9333 npm run app:debug &`, then
    `npx playwright-cli attach --cdp=http://localhost:9333` and use `snapshot`, `click <ref>`, `screenshot`
    (see `.claude/skills/playwright-cli`). Use a distinct port and `-s=<session>` per parallel agent.
