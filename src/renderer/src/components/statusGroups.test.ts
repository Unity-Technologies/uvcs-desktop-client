import { describe, expect, it } from 'vitest';
import { fileListGroupsOf, isStatusGroup, statusGroup, statusGroupsOf, withStatusGroups } from './statusGroups';
import type { StatusTone } from './StatusBadge';

interface File {
  path: string;
  tone: StatusTone;
}

const toneOf = (file: File) => file.tone;
const file = (path: string, tone: StatusTone): File => ({ path, tone });

describe('statusGroupsOf', () => {
  it("groups the files by status in the chips' order, keeping their order in each", () => {
    const sorted = [file('a.ts', 'added'), file('b.ts', 'changed'), file('c.ts', 'added'), file('d.ts', 'private'), file('e.ts', 'moved')];
    const groups = statusGroupsOf({ sorted, toneOf, scope: 'default', groupOf: (tone) => tone });
    expect(groups.map((group) => [group.key, group.label, group.sorted.map((item) => item.path)])).toEqual([
      ['status:default:changed', 'Changed', ['b.ts']],
      ['status:default:moved', 'Moved', ['e.ts']],
      ['status:default:added', 'Added', ['a.ts', 'c.ts']],
      ['status:default:private', 'Private', ['d.ts']],
    ]);
  });

  it('gives no group to a status no file has, and none at all without files', () => {
    expect(statusGroupsOf({ sorted: [], toneOf, scope: 'all', groupOf: (tone) => tone })).toEqual([]);
  });

  it("names a status as the list's chips do", () => {
    const [group] = statusGroupsOf({ sorted: [file('a.ts', 'conflict')], toneOf, scope: 'all', groupOf: (tone) => tone, toneLabels: { conflict: 'Conflicts with your changes' } });
    expect(group!.label).toBe('Conflicts with your changes');
  });

  it('keys the groups of each scope apart, so one closes alone', () => {
    const keys = ['one', 'two'].map((scope) => statusGroupsOf({ sorted: [file('a.ts', 'added')], toneOf, scope, groupOf: (tone) => tone })[0]!.key);
    expect(new Set(keys).size).toBe(2);
  });
});

describe('isStatusGroup', () => {
  it("tells a status group from a list's own groups", () => {
    expect(isStatusGroup(statusGroup('added'))).toBe(true);
    expect(isStatusGroup('conflicts')).toBe(false);
    expect(isStatusGroup(undefined)).toBe(false);
  });
});

describe('withStatusGroups', () => {
  const facts = { toneOf, statusGroup };

  it("puts the files of a list without groups in a group per status", () => {
    const groups = withStatusGroups({ sorted: [file('a.ts', 'added'), file('b.ts', 'changed')] }, facts);
    expect(groups.map((group) => [group.label, group.group])).toEqual([
      ['Changed', { status: 'changed' }],
      ['Added', { status: 'added' }],
    ]);
  });

  it("puts the files of each of the list's own groups in a group per status, inside it", () => {
    const content = { groups: [{ key: 'group:conflicts', label: 'Conflicts', group: statusGroup('conflict'), sorted: [file('a.ts', 'changed'), file('b.ts', 'deleted')] }] };
    const [conflicts] = withStatusGroups(content, facts);
    expect(conflicts!.subgroups!.map((group) => group.key)).toEqual(['status:group:conflicts:changed', 'status:group:conflicts:deleted']);
    expect(conflicts!.sorted).toHaveLength(2);
  });
});

describe('fileListGroupsOf', () => {
  const files = [file('a.ts', 'added'), file('b.ts', 'changed')];
  const ownGroups = { groups: [{ key: 'group:changes', label: 'Changes to apply', group: statusGroup('changed'), sorted: files }] };
  const facts = { toneOf, statusGroup };

  it('shows a list without groups of its own in status groups, or without groups', () => {
    expect(fileListGroupsOf({ sorted: files }, true, facts)!.map((group) => group.label)).toEqual(['Changed', 'Added']);
    expect(fileListGroupsOf({ sorted: files }, false, facts)).toBeNull();
  });

  it("puts status groups inside a list's own groups (Incoming's), or keeps its own alone", () => {
    expect(fileListGroupsOf(ownGroups, true, facts)![0]!.subgroups!.map((group) => group.label)).toEqual(['Changed', 'Added']);
    expect(fileListGroupsOf(ownGroups, false, facts)).toBe(ownGroups.groups);
  });

  it('keeps the own groups of a list that offers no status groups (the merge page), whatever is chosen', () => {
    expect(fileListGroupsOf(ownGroups, true, { toneOf })).toBe(ownGroups.groups);
  });
});
