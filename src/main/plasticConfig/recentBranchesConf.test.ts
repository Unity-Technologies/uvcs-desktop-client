import { describe, expect, it } from 'vitest';
import { readRecentBranches, withRecentBranch } from './recentBranchesConf';

const WK = 'c3a2e78b-b76a-4c9a-a564-35aaab18c8a5';
const OTHER_WK = '0364e73d-2aaf-439d-9488-73fd8e87692c';
const guid = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;

const conf = [
  'CurrentWorkspace=/Users/me/wkspaces/codice',
  '',
  `[${OTHER_WK}]`,
  `recentbranches=${guid(9)};`,
  '',
  `[${WK}]`,
  'loadedview=PendingChangesView',
  `recentbranches=${guid(1)};${guid(2)};${guid(3)};`,
  '',
].join('\n');

describe('readRecentBranches', () => {
  it("reads the workspace's section, newest first", () => {
    expect(readRecentBranches(conf, WK)).toEqual([guid(1), guid(2), guid(3)]);
    expect(readRecentBranches(conf, OTHER_WK)).toEqual([guid(9)]);
  });

  it('is empty without the section, the entry or the file', () => {
    expect(readRecentBranches(conf, guid(5))).toEqual([]);
    expect(readRecentBranches(`[${WK}]\nloadedview=x\n`, WK)).toEqual([]);
    expect(readRecentBranches('', WK)).toEqual([]);
  });

  it('parses like the official client: case-insensitive keys, the last entry wins, sections merge, bad GUIDs are skipped', () => {
    const messy = [`[${WK}]`, `recentbranches=${guid(1)};`, `[ ${OTHER_WK} ]`, `[${WK}]`, `RecentBranches=${guid(2)};nope;{${guid(3).toUpperCase()}};`].join('\r\n');
    expect(readRecentBranches(messy, WK)).toEqual([guid(2), guid(3)]);
  });
});

describe('withRecentBranch', () => {
  it('moves the branch first and leaves the rest of the file alone', () => {
    const next = withRecentBranch(conf, WK, guid(3).toUpperCase());
    expect(readRecentBranches(next, WK)).toEqual([guid(3), guid(1), guid(2)]);
    expect(next).toBe(conf.replace(`${guid(1)};${guid(2)};${guid(3)};`, `${guid(3)};${guid(1)};${guid(2)};`));
  });

  it('keeps five', () => {
    let next = conf;
    for (const n of [4, 5, 6, 7]) next = withRecentBranch(next, WK, guid(n));
    expect(readRecentBranches(next, WK)).toEqual([guid(7), guid(6), guid(5), guid(4), guid(1)]);
  });

  it("adds the entry to the workspace's section, or the section at the end", () => {
    expect(withRecentBranch(`[${WK}]\r\nloadedview=x\r\n`, WK, guid(1))).toBe(`[${WK}]\r\nrecentbranches=${guid(1)};\r\nloadedview=x\r\n`);
    expect(withRecentBranch('a=1\n', WK, guid(1))).toBe(`a=1\n\n[${WK}]\nrecentbranches=${guid(1)};\n\n`);
    expect(withRecentBranch('', WK, guid(1))).toBe(`[${WK}]\nrecentbranches=${guid(1)};\n\n`);
  });
});
