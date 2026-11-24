import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

/**
 * No external tool opens by itself: `cm` never gets to open its merge or diff tool, and a merge tool opens only when
 * the user asks for it on one conflicting file, through `merge/mergeTools/launch.ts`. This scans the `cm` argument
 * lists written in the main process for the commands that could open one, and who starts processes at all.
 */

const MAIN_DIRECTORY = join(__dirname, '..');

interface CmArgs {
  file: string;
  command: string;
  text: string;
}

/** Array literals whose first element is a string, e.g. `['merge', spec, '--merge']`, with their whole text. */
function findArgLists(source: string, file = ''): CmArgs[] {
  const lists: CmArgs[] = [];
  const start = /\[\s*'([a-z]+)'/g;
  for (let match = start.exec(source); match; match = start.exec(source)) {
    const end = closingBracket(source, match.index);
    lists.push({ file, command: match[1]!, text: source.slice(match.index, end + 1) });
  }
  return lists;
}

function closingBracket(source: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let index = open; index < source.length; index++) {
    const char = source[index]!;
    if (quote) {
      if (char === '\\') index++;
      else if (char === quote) quote = null;
    } else if (char === "'" || char === '"' || char === '`') {
      quote = char;
    } else if (char === '[') {
      depth++;
    } else if (char === ']' && --depth === 0) {
      return index;
    }
  }
  return source.length - 1;
}

const allSources = filesUnder(MAIN_DIRECTORY, isAppSource).map((file) => ({ file, source: readFileSync(file, 'utf8') }));
const relative = (file: string): string => file.slice(MAIN_DIRECTORY.length + 1).split(sep).join('/');
const allArgLists = allSources.flatMap(({ file, source }) => findArgLists(source, file));
const describeList = (list: CmArgs): string => `${list.file}: ${list.text}`;
const sourceOf = (file: string): string => allSources.find((source) => relative(source.file) === file)!.source;
const filesCalling = (call: RegExp): string[] => allSources.filter(({ source }) => call.test(source)).map(({ file }) => relative(file));

/** A class method's first line, as the app writes them: `  private async name(…`, indented once. */
const METHOD_START = /^ {2}(?:(?:private|async|static|readonly) )*(\w+)\(/gm;

/** The methods of a class whose body holds `call` (a global pattern), each once, sorted. */
function methodsCalling(source: string, call: RegExp): string[] {
  const starts = [...source.matchAll(METHOD_START)].map((match) => ({ name: match[1]!, at: match.index }));
  const names = [...source.matchAll(call)].map((match) => starts.filter((start) => start.at < match.index).at(-1)?.name ?? '(none)');
  return [...new Set(names)].sort();
}

describe('findArgLists', () => {
  it('reads whole argument lists, including spreads and nested arrays', () => {
    const lists = findArgLists("run(['merge', ...args(['x']), '--merge', `--to=${a[0]}`, '--nointeractiveresolution'])");
    expect(lists[0]).toMatchObject({ command: 'merge' });
    expect(lists[0]!.text).toContain('--nointeractiveresolution');
  });
});

describe('cm commands never open an external tool', () => {
  it('finds the argument lists to check', () => {
    expect(allArgLists.some((list) => list.command === 'merge' && list.text.includes("'--merge'"))).toBe(true);
  });

  it('runs every merge non-interactively', () => {
    const interactive = allArgLists.filter(
      (list) => list.command === 'merge' && list.text.includes("'--merge'") && !list.text.includes("'--nointeractiveresolution'"),
    );
    expect(interactive.map(describeList)).toEqual([]);
  });

  it('never applies shelves with `cm shelveset apply`, which opens the merge tool on conflicts', () => {
    const applies = allSources.filter(({ source }) => /(?<!'partial',\s*)'shelveset',\s*'apply'/.test(source)).map(({ file }) => file);
    expect(applies).toEqual([]);
  });

  it('applies a shelve with `cm partial shelveset apply` only where it first checks no merge is needed', () => {
    const applies = allSources.filter(({ source }) => /'partial',\s*'shelveset',\s*'apply'/.test(source)).map(({ file }) => relative(file));
    expect(applies).toEqual(['workspace/applyShelveCleanly.ts']);
  });

  it('never checks in with --update, which merges with the merge tool', () => {
    expect(allArgLists.filter((list) => list.command === 'checkin' && list.text.includes('--update')).map(describeList)).toEqual([]);
  });

  it('never updates without --dontmerge', () => {
    expect(allArgLists.filter((list) => list.command === 'update' && !list.text.includes("'--dontmerge'")).map(describeList)).toEqual([]);
  });

  it('only diffs with --format, since a plain `cm diff` of a file opens the diff tool', () => {
    expect(allArgLists.filter((list) => list.command === 'diff' && !list.text.includes('--format')).map(describeList)).toEqual([]);
  });
});

describe('merge tools open only on the user’s request', () => {
  it('starts processes only to run cm, open an app the user picked (an editor, a terminal, a merge tool), ask the OS which apps are installed, ask codesign how the app is signed, read the folder dragged over a window (osascript), find the UVCS tray that serves dynamic workspaces (tasklist), or make an AppImage the handler of uvcs:// links (xdg-mime, which opens nothing), unpack the app’s own cm (tar), or update the installed one (its installer, on the user’s click, after checking its signature; dpkg and rpm, which open nothing)', () => {
    const spawning = allSources.filter(({ source }) => source.includes("'node:child_process'")).map(({ file }) => relative(file));
    expect(spawning.sort()).toEqual([
      'cm/CmShellSession.ts',
      'cm/runCmProcess.ts',
      'cmRuntime/officialUpdate/officialUpdateTools.ts',
      'cmRuntime/unpackBundle.ts',
      'links/xdgMime.ts',
      'merge/mergeTools/launch.ts',
      'system/apps/launchApp.ts',
      'system/apps/readInstalledApps.ts',
      'system/dragPasteboard.ts',
      'system/uvcsTray.ts',
      'update/macSignature.ts',
    ]);
  });

  it('opens editors and terminals only from the catalog behind "Open in…", wired once', () => {
    const launching = allSources.filter(({ source }) => /from '[./]*(system\/)?apps\/launchApp'/.test(source)).map(({ file }) => relative(file));
    expect(launching).toEqual(['services/createServices.ts']);
  });

  it('launches merge tools (and Smart Merge) only from the service behind "Resolve in…"', () => {
    // Any value import of `launch`, a sibling's `./launch` included; `import type` starts nothing.
    const importsLaunch = /^import (?!type )[^;]*from '(\.\/|[./]*(merge\/)?mergeTools\/)launch';/m;
    const launching = allSources.filter(({ source }) => importsLaunch.test(source)).map(({ file }) => relative(file));
    expect(launching).toEqual(['services/mergeToolsService.ts']);
  });

  it('runs the installed one’s installer only on the user’s click: Update, or Restart & Install of an app update, never as background work', () => {
    // Two callers of `install`, both in `CmRuntime`: Update (`updateInstalled`), and the app update's prefetch
    // (`installAhead`), which only Restart & Install runs.
    const installs = allSources.filter(({ source }) => /officialUpdate\.install\(/.test(source)).map(({ file }) => relative(file));
    expect(installs).toEqual(['cmRuntime/CmRuntime.ts']);
    expect(methodsCalling(sourceOf('cmRuntime/CmRuntime.ts'), /officialUpdate\.install\(/g)).toEqual(['installAhead', 'updateInstalled']);
    // Update: only the service behind the Update buttons calls it.
    expect(filesCalling(/\.updateInstalled\(/)).toEqual(['services/cmRuntimeService.ts']);
    // Restart & Install: `installAhead` is only the prefetch's `install`, which `AppUpdates` keeps as `installCm` and runs
    // only from `install`, the one the service behind Restart & Install calls.
    expect(methodsCalling(sourceOf('cmRuntime/CmRuntime.ts'), /this\.installAhead\(/g)).toEqual(['installedPrefetchFor']);
    expect(methodsCalling(sourceOf('update/AppUpdates.ts'), /\binstallCm\(\)/g)).toEqual(['installCmFirst']);
    expect(methodsCalling(sourceOf('update/AppUpdates.ts'), /this\.installCmFirst\(/g)).toEqual(['install']);
    expect(filesCalling(/\bupdates\.install\(\)/)).toEqual(['services/updatesService.ts']);
  });
});
