# Unity Version Control — Desktop

A fast, beautiful desktop client for Unity Version Control (Plastic SCM). Electron + React 19 + TypeScript, diffs by
`@pierre/diffs`, data by TanStack Query. It has no backend of its own: every operation is a `cm` command.

## Context

- **A long-term maintenance product.** Every decision must still be right in years: prefer the boring, explicit,
  well-named solution over the clever or quick one, and leave each file easier to change than it was.
- **Mostly changed and maintained by LLMs.** Write for a reader who arrives cold, with no memory of this conversation:
  the code, its names, its tests and `docs/` are the only memory. Name symbols in docs so they can be grepped.

## Principles (the bar every change is held to)

- **Clean code — the most important principle.** Clean for humans *and* for LLMs. Names (files, classes, methods,
  vars) are precise and reveal intent. Methods are small and readable; files stay small — when something grows, split
  it into meaningful, cohesive pieces. No clever tricks, no dead code, no duplication. Optimize for the next reader.
- **Max UX.** Advanced UVCS usage (merges, shelves, switching with changes, xlinks, locks, code reviews) must feel
  effortless. Never drop the user into a terminal, editor, or UVCS jargon they didn't ask for.
- **Simple UI, powerful engine.** Complexity lives in the main process, never in the user's face. If a feature needs
  explaining, the design isn't done. Favor fewer, sharper features over more knobs.
- **Fast, reliable, beautiful** — UI *and* code, verified on screen, not in the diff (see "Seeing the app"). Two
  themes, one calm layout.
- **`cm` economy: protect the server.** `cm` is not `git`: almost every command is a network round trip to a server
  many people share (a large production repository holds ~280k changesets, ~20k branches). See "Every `cm` command
  earns its place".

## Read before changing code

1. `docs/ARCHITECTURE.md` — always. Layers, how a request flows, the server budget, `cm` parsing rules, xlinks,
   secrets, windows, and the renderer's shared conventions (data, refresh, menus, keyboard, filters, lists, styling).
2. The feature doc of the area you touch, listed at the top of ARCHITECTURE.md (`docs/features/*.md`).
3. The code next to what you change, and its tests: they show the idiom to follow.

This file holds the rules and where to find things; ARCHITECTURE.md holds the details and the numbers. When they
seem to disagree, the code and its tests decide, and the doc gets fixed.

## Architecture in one screen

```
src/shared/    Types + the API contract (`UvcsApi`, `shared/api/<area>.ts`), events. No runtime deps.
src/main/      Electron main process: every `cm` call (`main/cm`, `main/services`), file system, watchers, windows.
src/preload/   Exposes `window.uvcs` (one invoke channel + events). Never changes for a new feature.
src/renderer/  React UI. Talks to main only through `api.<area>.<method>` (`renderer/src/api/client.ts`).
```

- **Adding a capability**: ARCHITECTURE.md "How a request flows" (domain type → `shared/api` → service wired in
  `createServices` → pure, tested `cm` helpers in `main/cm/` → a query or mutation in the renderer).
- **`CmClient`** is the single entry point to `cm`. Never spawn `cm` any other way.
- **Renderer tiers**: `ui/` design-system primitives, `components/` domain-aware pieces shared by features,
  `features/<area>/` one folder per area, `lib/` pure helpers, `app/` the shell (navigation, palette, operations,
  refresh), `styles/` tokens and global CSS. A piece used by one feature lives in that feature's folder.

## Every `cm` command earns its place

Before adding or changing a `cm` call, answer these (the why and the numbers: ARCHITECTURE.md "Server budget" and
"How a request flows"):

1. **Is it needed at all?** Can a result already read answer it (a list's `--format` fields, `BranchNamesCache`, the
   workspace info that follows `.plastic`, `cm status` already on screen)? Only local reads are free (the list is
   `LOCAL_COMMANDS` in `main/cm/repeatedCommands.ts`); everything else hits the server.
2. **One call for N things.** Never loop a command over rows, files, branches or ids, and never OR ids together. One
   `cm find`/`cm ls` with `--format` holding just the fields needed, filtered on the server (date, `limit`, owners).
3. **Shell or process?** By duration and cancellability, never by read vs write. Quick (reads, a label, a rename, an
   undo of a few files) → `query()`, a pooled `cm shell`: a process costs 100–150 ms before the command runs. Long,
   streamed or cancellable (update, switch, checkin, shelve, merge, sync, the slowest `find`s) → `execute()`: a
   workspace has two pooled sessions, and a command holding one for seconds stalls every read behind it. `query()`
   already sends a write that may run long (`runsLong`) to a process. Shell arguments can't hold quotes or newlines:
   multi-line text goes through temp files (`-commentsfile`).
4. **When does it run?** Only on an event, a settled selection (`useSettled`), a focus once stale, or an operation —
   never on a timer (the incoming check is the one exception). Immutable results use `IMMUTABLE_QUERY`, heavy lists
   that rarely change `SLOW_CHANGING_QUERY`, equivalent filters share one query key (`compactFilter`).
5. **What does it refresh?** An operation declares what it `affects` (`refreshScopes.ts`); reads refresh nothing.
6. **Check it.** Watch the command log (⌘⇧L) while exercising the change and count the commands. Development builds
   warn `[server budget]` in the console when a server command repeats more than twice in ten seconds.

## Safety

- **Secrets never show**: the command log, `CmError`s and console warnings hide passwords (`main/cm/hideSecrets.ts`).
  A new `cm` option carrying a secret joins `SECRET_OPTIONS`; never log, toast or store a credential yourself.
- **The renderer is untrusted**: keep `contextIsolation` and `sandbox` on, and give it capabilities only as typed
  `UvcsApi` methods, never a generic "run this" channel.
- **Nothing external opens by itself**: `cm` never opens a merge or diff tool, and background work never opens anything.
- **Never write to real data**: anything that writes (checkin, merge, delete, the sandboxes' scripts) runs only
  against a sandbox on a local server, never the user's workspaces or a shared server.
  The sandbox scripts delete and recreate their repository and workspace.

## Commands

npm (Node ≥ 22.12). `cm` must be installed and signed in; set `UVCS_CM_PATH` to use a `cm` that isn't found.

```bash
npm run dev          # the app with hot reload
npm run build        # build into out/ (needed by start, app:debug and scripts/screenshot.mjs)
npm start            # the built app
npm run app:debug    # the built app with CDP on UVCS_CDP_PORT (9333 by default)
npm run typecheck    # main + renderer
npm test             # vitest, every src/**/*.test.ts and scripts/build/**/*.test.ts
npm run e2e          # build, then the smoke test: every view of the real app against a fake cm (~10 s)
npm run dist         # the installer for this OS, into dist/
npm run release      # dist, uploaded to the GitHub release (the Release workflow runs it; needs GH_TOKEN)
node scripts/perf/startup.mjs [--cm=real]   # after a build: median start-up times, cold and warm (header: options)
```

**Done means**: `npm run typecheck` and `npm test` pass, the new code is tested (see "Tests are the quality gate"),
the change is seen working in the app (anything visible), and the docs say what's now true (see "Docs"). There is no
linter or formatter: match the surrounding code. Before merging anything that touches startup, navigation or many
views, `npm run e2e` passes too.

## Seeing the app (Playwright)

For anything complex or that needs to be seen — UI, layout, diff rendering, themes, multi-step flows — drive the real
app; don't just trust types and tests. **Always use the `playwright-cli` skill** (`.claude/skills/playwright-cli`);
don't hand-roll Playwright calls. Build, start the app as a background process, attach, and stop it when done:

```bash
npm run build && UVCS_CDP_PORT=9333 npm run app:debug    # in the background
npx playwright-cli attach --cdp=http://localhost:9333    # then snapshot, click <ref>, screenshot, console
```

- Check **both themes** and a narrow window, and that the console shows no errors (`playwright-cli console`).
- Parallel agents: a distinct `UVCS_CDP_PORT` and `-s=<session>` each.
- One-shot screenshots: `node scripts/screenshot.mjs /tmp/shot.png open:<workspace> key:Meta+3` (steps in its header;
  it prints renderer errors as `[renderer]` and `[pageerror]`).
- Sandboxes on a local server: `scripts/sandboxes/demo.sh` (a small game project), `branch-explorer.sh` (a branch
  topology), `long-branch-names.sh` (very long, nested and non-ASCII branch names; a task that conflicts), `moves.sh`
  (every kind of move, some changed too, checked in and pending), `permissions.sh` (permissions at every level, a
  secured path and a group of branches; never the server's own).
  `scripts/perf/soak.mjs` catches leaks.
- `UVCS_RENDERER_PLATFORM=win32` (or `linux`) previews another OS's shortcuts, copy and layout from a Mac (the page
  only: the menus and window frame stay the Mac's).

## Tests are the quality gate

No one remembers why the code is the way it is: each change is made by an agent that arrives cold. The only thing
that stops a new task from breaking an old one is the test suite, so it must be a faithful indicator of the product's
quality: **if the tests pass, the app works as specified**. Test what matters, not everything.

**Every new or changed piece of code ships with tests**, at the level where it can break:

- **Logic**: parsers, argument builders, layouts, filters, selection, anything that decides. Every branch that encodes
  a decision, and the edge cases the real world sends (empty, huge, Unicode, CRLF, xlinks, Windows paths).
- **Contracts between layers**: what a service asks `cm` (which commands, how many, `query()` or `execute()`) and how
  it reads the answer, with output shaped exactly as `cm` prints it; what crosses IPC (`UvcsApi`, events); what an
  operation refreshes (`refreshScopes`, query keys). `cm` is faked with `fakeCmClient` (see "`cm` output is
  synthetic"). Most services have no contract test yet: add one for the service you change.
- **Interactions**: flows across modules, including their failure paths: a switch with changes (shelve, undo,
  switch, bring; a failure puts the changes back), a menu builder serving every place, a shortcut reaching its command.
- **Specs**: a rule written in `docs/` deserves a test that enforces it; a rule for the whole repository becomes a
  static test ("Rules the tests enforce" below). A bug fix starts with a test that fails without it.

**Don't test** what the type checker already proves, pass-through code, the libraries' own behaviour (React, TanStack
Query, Pierre), or implementation details (private helpers, call order nobody relies on). A test should fail only
when something a user or another layer relies on changes; one that breaks on every refactor is noise.

Components (`.tsx`) aren't unit-tested (vitest runs `*.test.ts` only): keep their logic in pure `.ts` modules or hooks
built on them, and verify what's on screen with Playwright.

**Super fast.** The number of tests doesn't matter; the time they take does (today about 3,300 tests in 6 s).
The suite runs after every change, so it must take seconds, not minutes. A test never needs UVCS infrastructure: no
`cm` installation, server, account, network or real workspace.

- **Test each layer with the input it takes, not the layer below.** A view that shows 10 branches gets 10 branches
  built in the test; it never asks a server for them.
- **`cm` output is synthetic**: to test a parser, write the output as `cm` prints it (`--xml`, `--format` records,
  `CommandResult` lines) as a string in the test, or with `main/cm/testing/cmOutput` (`formatOutput`, `findXml`,
  `statusHeader`...); never run `cm`. Code that runs `cm` gets `fakeCmClient` (`main/cm/testing/`): it answers from
  such strings, records the commands it was asked and how (`query` or `execute`), and fails on any other. A workspace
  that changes as `cm` would is `playAlongWorkspace`, built on it. The `cm shell` protocol itself is tested against
  `main/cm/testing/fakeCmShell`, a script that answers like `cm shell`.
- **The smoke test** (`npm run e2e`, `scripts/e2e/README.md`) drives the built app over a fake `cm` and a temp
  workspace: startup, every sidebar view, a diff, the palette, Settings, a theme switch; it fails on renderer errors
  and on any `cm` command the fake doesn't know. A view that starts running a new command teaches it to the fake
  (`scripts/e2e/fakeCm/answers.cjs`); a new view is one line in `smoke.mjs`'s `VIEWS`.
- **The renderer's fakes** are in `renderer/src/testing/`: `fakeWindow` (`window.uvcs`; `fakeApi` answers the calls a
  test declares and fails it on any other), `fakeDialogs` (confirm and prompt), `operationOutcome` (the toasts, where
  the window went, the views refreshed), `queryProbes`.

**Never flaky.** A test that sometimes fails teaches everyone to ignore failures. Fix its cause at once; never retry,
skip or loosen it.

- **No real time**: no sleeps or waits for a duration. Use `vi.useFakeTimers()` and advance them; pass clocks, ids and
  random sources in instead of reading `Date.now()` or `Math.random()` inside the logic. A performance guard counts
  work, never time (`shared/testing/`: `countedReads`, `countCharactersRead`, `countCalls`).
- **Await outcomes**: await the promise or the event that means "done", never poll against a timeout.
- **Isolated**: each test builds its own state (new instances, its own temp folder under `os.tmpdir()`, which the run
  already points at a private folder: `vitest.tempDirectory.ts`), no mutable module state, mocks restored after each
  test. Tests pass alone, in any order, and in parallel.
- **Same on every OS**: build paths with `path.join`, don't assume `/` or `\n`, sort before comparing what has no
  order.
- **Precise assertions**: compare the result that matters (`toEqual` on the value), not snapshots of large objects.

### Rules the tests enforce

Static tests keep the load-bearing rules; extend them rather than working around them.

| Test                                                      | Rule                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| `main/cm/noExternalUi.test.ts`                            | `cm` never opens a tool; processes start only where allowed       |
| `main/cm/noOredIdLookups.test.ts`                         | no `where id = 1 or id = 2 …` queries                             |
| `shared/noRuntimeDependencies.test.ts`                    | `shared/` imports only its own modules                            |
| `renderer/src/rendererTiers.test.ts`                      | `lib/` and `ui/` never import the tiers above them                |
| `lib/shortcutRegistry.test.ts`                            | every shortcut is in the registry; menu accelerators match; no Ctrl+Alt off Mac |
| `lib/menuGroups.test.ts`, `components/menuGrammar.test.ts` | every object menu follows one grammar                            |
| `styles/tokens.test.ts`, `focusRings.test.ts`             | text 4.5:1 and focus rings 3:1 in both themes                     |
| `styles/noRawColors.test.ts`                              | colors come from `styles/tokens.css`; the few written out say why |
| `window/workspaceMenuCommands.test.ts`                    | app menu commands match the workspace commands                    |
| `main/settings/ownConfig.test.ts`                         | only the first-run import reads the official client's config; nothing writes it |
| `scripts/build/dependencyLicenses.test.ts`                | every package in package-lock.json has a permissive license (`PERMISSIVE_LICENSES`) |
| `scripts/build/pinnedActions.test.ts`                     | every GitHub action is pinned to a commit SHA                     |

Not enforced yet: no `any` (there are none today). A static test for it is welcome.

## Conventions

- **Code style**: TypeScript strict, no `any`, single quotes, semicolons. `@shared/*` for shared imports.
  One component, hook or concept per file, named after it.
- **Comments explain *why*** (a `cm` quirk, a Windows code page, a Pierre workaround), briefly, naming the symbol or
  command involved. Don't strip existing rationale when moving code.
- **Cross-platform**: macOS, Windows and Linux are all first-class. Platform differences go through small pure helpers
  that take the platform (`lib/platform.ts`, `shared/windowChrome.ts`, `formatShortcut` in `lib/shortcuts.ts`). Watch
  path separators and drive letters, CRLF, NFD names on macOS, Windows' console code page and 32,767-character
  command lines (ARCHITECTURE.md "Parsing `cm` output").
- **Copy**: plain words, short. Labels name things, tooltips define them, no sentence restates what the screen shows.
  UVCS terms only where the user already uses them (branch, changeset, shelve); never `cm` output or flags.
- **UI building blocks**: reuse before inventing — `ListWithDetails`/`DetailsPanel`, `ItemRow`, `FilterBar`,
  `menuWords`/`groupedMenu`, `openDialog`/`confirm`, `runOperation`. Shortcuts only through `lib/shortcutRegistry.ts`.
  Colors, motion and focus only through `styles/tokens.css`.
- **Own config**: the app keeps its settings in its own store; it never writes to or keeps reading the official
  Desktop client's config, only imports well-known values once, on the first run (`importLegacySettings`;
  ARCHITECTURE.md "Own config").
- **Dependencies**: every package is a `devDependency`, because electron-vite bundles what the app runs into `out/`
  (`electron-builder.yml` ships no `node_modules`). Prefer none: a new one must do what a small module can't.
- **Generated, never edited**: `out/`, `dist/`, `*.tsbuildinfo`, `node_modules/`.
- **Releases own the version**: the Release workflow bumps the last release tag's version and pushes only the new
  tag (main's `package.json` isn't kept in step); never bump it by hand. The app updates itself from those releases
  (`docs/features/updates.md`).
- **Code signing** (macOS, with notarization, and Windows) is wired into the Release workflow and turns on once its
  secrets exist (`docs/features/updates.md`).

## Commits: let the history tell the story

Commit like a careful human. The history should show *how* the work happened.

- One logical change per commit. If the message needs "and", split it.
- Commit small and often. Keep commits layer-specific (model, service, UI, tests, docs, config).
- Never mix machine changes (renames, formatting, dependencies, generated code) with human changes.
- Test first: commit the failing test, then the fix (on working branches only, never on `main`).
- A refactor commit stands alone, with no other change, and keeps the tests green.
- A commit message says what the user can now do or see, in the product's words, not which files changed ("The
  Branch Explorer keeps the user's place when it is laid out again …"). Changes to docs or tooling say what they
  change in a short line.
- A branch is named for its work: `<kind>/<topic>` in kebab case, where kind is `feature`, `fix`, `refactor`,
  `tests`, `docs`, `perf` or `chore` (`fix/palette-apostrophe`, `refactor/main-services`). An agent whose worktree
  came with a generated name (`worktree-agent-a571eb…`) renames it first: `git branch -m <kind>/<topic>`.
- Parallel agents each work in their own git worktree and branch (`.claude/worktrees/`, ignored). A verified branch
  joins `main` with a merge commit, never squashed or rebased: the real path is the story. Don't squash or rewrite
  history unless the user asks.

## Docs

- `docs/` describes how the app works **now**, never its history. A change that alters behaviour, a `cm` quirk or a
  convention updates the relevant doc in the same commit.
- Rules every change must respect go in `docs/ARCHITECTURE.md`; one area's rules go in its `docs/features/*.md`
  (create one when a new area has rules the code can't show, and list it at the top of ARCHITECTURE.md). Name the
  symbols (`inCmPathForm`) so they can be found. Say each rule in one place and point to it from the others.
- Record why an obvious alternative was rejected when it was tried, so it isn't proposed again.
