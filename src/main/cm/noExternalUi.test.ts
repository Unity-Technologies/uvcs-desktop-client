import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The app never opens an external tool (cm's merge or diff tool): every conflict is resolved in its own
 * merge view. This scans the `cm` argument lists written in the main process for the commands that could.
 */

const MAIN_DIRECTORY = join(__dirname, '..');

interface CmArgs {
  file: string;
  command: string;
  text: string;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
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

const allSources = sourceFiles(MAIN_DIRECTORY).map((file) => ({ file, source: readFileSync(file, 'utf8') }));
const allArgLists = allSources.flatMap(({ file, source }) => findArgLists(source, file));
const describeList = (list: CmArgs): string => `${list.file}: ${list.text}`;

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
    const applies = allSources.filter(({ source }) => /'shelveset',\s*'apply'/.test(source)).map(({ file }) => file);
    expect(applies).toEqual([]);
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
