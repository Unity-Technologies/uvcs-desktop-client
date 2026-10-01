import { describe, expect, it } from 'vitest';
import { readRecentBranchesByWorkspace } from './recentBranchesConf';

const WK = 'c3a2e78b-b76a-4c9a-a564-35aaab18c8a5';
const OTHER_WK = '0364e73d-2aaf-439d-9488-73fd8e87692c';
const guid = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;

describe('readRecentBranchesByWorkspace', () => {
  it("reads every workspace's section, newest first", () => {
    const conf = [
      'CurrentWorkspace=/Users/me/wkspaces/acme',
      '',
      `[${OTHER_WK}]`,
      `recentbranches=${guid(9)};`,
      '',
      `[${WK}]`,
      'loadedview=PendingChangesView',
      `recentbranches=${guid(1)};${guid(2)};${guid(3)};`,
      '',
    ].join('\n');
    expect(readRecentBranchesByWorkspace(conf)).toEqual({ [OTHER_WK]: [guid(9)], [WK]: [guid(1), guid(2), guid(3)] });
  });

  it('leaves out sections that are not workspaces, or have no recent branches', () => {
    expect(readRecentBranchesByWorkspace(`recentbranches=${guid(1)};\n[general]\nrecentbranches=${guid(2)};\n[${WK}]\nloadedview=x\nrecentbranches=\n`)).toEqual({});
    expect(readRecentBranchesByWorkspace('')).toEqual({});
  });

  it('parses like the official client: case-insensitive keys, the last entry wins, sections merge, bad GUIDs are skipped', () => {
    const messy = [
      `[${WK}]`,
      `recentbranches=${guid(1)};`,
      `[ ${OTHER_WK.toUpperCase()} ]`,
      `[${WK}]`,
      `RecentBranches=${guid(2)};nope;{${guid(3).toUpperCase()}};`,
      '# recentbranches=ignored',
    ].join('\r\n');
    expect(readRecentBranchesByWorkspace(messy)).toEqual({ [WK]: [guid(2), guid(3)] });
  });

  it('reads garbage as no recent branches', () => {
    expect(readRecentBranchesByWorkspace('\u0000ÿ[[[=\n]]]\nrecentbranches')).toEqual({});
  });
});
