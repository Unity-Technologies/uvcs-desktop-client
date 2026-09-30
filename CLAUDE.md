# Unity Version Control — Desktop

A fast, beautiful desktop client for Unity Version Control (Plastic SCM). Electron + React 19 + TypeScript, diffs by
`@pierre/diffs`, data by TanStack Query. It has no backend of its own: every operation is a `cm` command.

## Context

- **A long-term maintenance product.** Every decision must still be right in years: prefer the boring, explicit,
  well-named solution over the clever or quick one, and leave each file easier to change than it was.
- **Mostly changed and maintained by LLMs.** Write for a reader who arrives cold, with no memory of this conversation:
  the code, its names, its tests and `docs/` are the only memory. Name symbols in docs so they can be grepped. Prefer a
  test that enforces a rule (see "Rules the tests enforce") over a comment asking for it.

## Principles (the bar every change is held to)

- **Clean code — the most important principle.** Clean for humans *and* for LLMs. Names (files, classes, methods,
  vars) are precise and reveal intent. Methods are small and readable; files stay small — when something grows, split
  it into meaningful, cohesive pieces. No clever tricks, no dead code, no duplication. Optimize for the next reader.
- **Max UX.** Advanced UVCS usage (merges, shelves, switching with changes, xlinks, locks, code reviews) must feel
  effortless. Never drop the user into a terminal, editor, or UVCS jargon they didn't ask for.
- **Simple UI, powerful engine.** Complexity lives in the main process, never in the user's face. If a feature needs
  explaining, the design isn't done.
- **Elegant, fast, reliable, beautiful** — UI *and* code. Two themes, one calm layout.
- **`cm` economy: protect the server.** `cm` is not `git`: almost every command is a network round trip to a server
  that many people share (repositories of ~280k changesets, ~20k branches). One command that returns N things beats N
  commands; a result already read beats another command. See "Every `cm` command earns its place" below.
- **Validate visually.** Beauty and UX are verified on screen, not in the diff (see "Seeing the app").

Favor fewer, sharper features over more knobs. Ask: *does this keep the UI simple while letting an expert reach for
the full power of UVCS?*

## Read before changing code

1. `docs/ARCHITECTURE.md` — always. Layers, how a request flows, the server budget, `cm` parsing rules, xlinks,
   windows, and the renderer's shared conventions (data, refresh, menus, keyboard, filters, lists, styling).
2. The feature doc of the area you touch, listed at the top of ARCHITECTURE.md (`docs/features/*.md`: diffs, merge,
   shelves and switching, files/history/annotate, Branch Explorer).
3. The code next to what you change, and its tests: they show the idiom to follow.

## Architecture in one screen

```
src/shared/    Types + the API contract (`UvcsApi`, `shared/api/<area>.ts`), events. No runtime deps.
src/main/      Electron main process: every `cm` call (`main/cm`, `main/services`), file system, watchers, windows.
src/preload/   Exposes `window.uvcs` (one invoke channel + events). Never changes for a new feature.
src/renderer/  React UI. Talks to main only through `api.<area>.<method>` (`renderer/src/api/client.ts`).
```

- **Adding a capability**: types in `shared/domain` → method in `shared/api/<area>.ts` → implementation in
  `main/services/<area>Service.ts` (wired in `createServices`) → `cm` argument builders and parsers as pure, tested
  helpers in `main/cm/` → a query (`queryKeys`) or mutation (`runOperation`/`runAction`/`runRead`) in the renderer.
- **`CmClient`** is the single entry point to `cm`: `query()` for reads (pooled `cm shell` sessions, much faster than a
  process), `execute()` for long, streamed or cancellable operations. Never spawn `cm` any other way.
- **Renderer tiers**: `ui/` design-system primitives, `components/` domain-aware pieces shared by features,
  `features/<area>/` one folder per area, `lib/` pure helpers, `app/` the shell (navigation, palette, operations,
  refresh), `styles/` tokens and global CSS. A piece used by one feature lives in that feature's folder.

## Every `cm` command earns its place

Before adding or changing a `cm` call, answer these (details in ARCHITECTURE.md "Server budget"):

1. **Is it needed at all?** Can a result already read answer it (a list's `--format` fields, `BranchNamesCache`, the
   workspace info that follows `.plastic`, `cm status` already on screen)? Local reads (`status`,
   `getworkspacefrompath`, `workspace list`, `version`) are cheap; everything else hits the server.
2. **One call for N things.** Never loop a command over rows, files, branches or ids, and never OR ids together
   (`noOredIdLookups.test.ts`). One `cm find`/`cm ls` that returns every record, `--format` with just the fields
   needed, filtered on the server (date, `limit`, owners) — then a second call only for what the first couldn't answer.
3. **Through `query()`** so it rides a warm `cm shell` (arguments without quotes or newlines: multi-line text goes
   through temp files, `-commentsfile`).
4. **When does it run?** Only on an event, a settled selection (`useSettled`), a focus once stale, or an operation —
   never on a timer (the incoming check is the one exception). Immutable results are cached (`IMMUTABLE_QUERY`),
   heavy lists that rarely change use `SLOW_CHANGING_QUERY`, equivalent filters share one query key (`compactFilter`).
5. **What does it refresh?** An operation declares what it `affects` (`refreshScopes.ts`); reads refresh nothing.
6. **Check it.** Watch the command log (⌘⇧L) while exercising the change: count the commands. Development builds warn
   `[server budget]` in the console when a server command repeats more than twice in ten seconds.

## Commands

npm (Node ≥ 22.12). `cm` must be installed and signed in.

```bash
npm run dev          # the app with hot reload
npm run build        # build into out/ (needed by app:debug and scripts/screenshot.mjs)
npm run app:debug    # the built app with CDP on UVCS_CDP_PORT (9333 by default)
npm run typecheck    # main + renderer
npm test             # vitest, every src/**/*.test.ts
npm run dist         # the installer for this OS
```

**Done means**: `npm run typecheck` and `npm test` pass, the change is seen working in the app (anything visible), and
the docs say what's now true (see "Docs"). There is no linter or formatter: match the surrounding code.

## Seeing the app (Playwright)

For anything complex or that needs to be seen — UI, layout, diff rendering, themes, multi-step flows — drive the real
app; don't just trust types and tests. **Always use the `playwright-cli` skill** (`.claude/skills/playwright-cli`,
installed); don't hand-roll Playwright calls. The flow: compile and run, then attach over CDP and exercise/screenshot:

```bash
npm run build && UVCS_CDP_PORT=9333 npm run app:debug &
npx playwright-cli attach --cdp=http://localhost:9333    # then snapshot, click <ref>, screenshot
```

- Check **both themes** and a narrow window; check that the console shows no errors.
- Parallel agents: a distinct `UVCS_CDP_PORT` and `-s=<session>` each.
- One-shot screenshots: `node scripts/screenshot.mjs /tmp/shot.png open:<workspace> key:Meta+3` (steps in its header).
- Sandboxes on a local server: `scripts/sandboxes/demo.sh` (a small game project), `branch-explorer.sh` (a branch
  topology). Use these, not a shared server, for anything that writes; `scripts/perf/soak.mjs` catches leaks.
- `UVCS_RENDERER_PLATFORM=win32` (or `linux`) previews another OS's shortcuts, copy and layout from a Mac (the page
  only: the menus and window frame stay the Mac's).

## Conventions

- **Code style**: TypeScript strict, no new `any`, single quotes, semicolons. `@shared/*` for shared imports.
  One component, hook or concept per file, named after it.
- **Comments explain *why*** (a `cm` quirk, a Windows code page, a Pierre workaround), briefly, naming the symbol or
  command involved. Don't strip existing rationale when moving code.
- **Tests**: vitest, `*.test.ts` next to the code (`.ts` only: components aren't unit-tested, so keep logic in pure
  `.ts` modules). Every behaviour change ships with tests; they must never be flaky (no timing races, no shared state,
  no ordering assumptions). `cm` parsers are tested against output shaped exactly as `cm` prints it; `CmShellSession` against
  `main/cm/testing/fakeCmShell`.
- **Cross-platform**: macOS, Windows and Linux are all first-class. Platform differences go through small pure helpers
  that take the platform (`lib/platform.ts`, `windowChrome`, `formatShortcut`). Watch path separators and drive
  letters, CRLF, NFD names on macOS, Windows' console code page and 32,767-character command lines (ARCHITECTURE.md
  "Parsing `cm` output").
- **Copy**: plain words, short. Labels name things, tooltips define them, no sentence restates what the screen shows.
  UVCS terms only where the user already uses them (branch, changeset, shelve); never `cm` output or flags.
- **UI building blocks**: reuse before inventing — `ListWithDetails`/`DetailsPanel`, `ItemRow`, `FilterBar`,
  `menuWords`/`groupedMenu`, `openDialog`/`confirm`, `runOperation`. Shortcuts only through `lib/shortcutRegistry.ts`.
  Colors, motion and focus only through `styles/tokens.css`.
- **Nothing external opens by itself**: `cm` never opens a merge or diff tool, and background work never opens anything.

## Rules the tests enforce

Static tests keep the load-bearing rules; extend them rather than working around them.

| Test                                       | Rule                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| `main/cm/noExternalUi.test.ts`             | `cm` never opens a tool; processes start only where allowed                  |
| `main/cm/noOredIdLookups.test.ts`          | no `where id = 1 or id = 2 …` queries                                        |
| `lib/shortcutRegistry.test.ts`             | every shortcut is in the registry; menu accelerators match; no Ctrl+Alt off Mac |
| `lib/menuGroups.test.ts`, `components/menuGrammar.test.ts` | every object menu follows one grammar                   |
| `styles/tokens.test.ts`, `focusRings.test.ts` | text 4.5:1 and focus rings 3:1 in both themes                             |
| `window/workspaceMenuCommands.test.ts`     | app menu commands match the workspace commands                               |

## Docs

- `docs/` describes how the app works **now**, never its history. A change that alters behaviour, a `cm` quirk or a
  convention updates the relevant doc in the same commit.
- Rules every change must respect go in `docs/ARCHITECTURE.md`; one area's rules go in its `docs/features/*.md`
  (create one when a new area has rules the code can't show). Name the symbols (`inCmPathForm`) so they can be found.
- Record why an obvious alternative was rejected when it was tried, so it isn't proposed again.
