import { describe, expect, it } from 'vitest';
import type { Branch } from '@shared/domain/branch';
import { ancestorsOf, destinationGroups } from './destinationChoices';

const branch = (name: string, date: string): Branch => ({
  id: 1,
  name,
  parent: '',
  comment: '',
  owner: 'me',
  date,
  headChangeset: 1,
  guid: name,
  repository: 'repo@local',
});

describe('ancestorsOf', () => {
  it('reads the ancestors from the name itself, nearest first', () => {
    expect(ancestorsOf('/main/release/task')).toEqual(['/main/release', '/main']);
    expect(ancestorsOf('/main/task')).toEqual(['/main']);
  });

  it('has none for a top-level branch', () => {
    expect(ancestorsOf('/main')).toEqual([]);
  });

  it('keeps names with spaces and accents whole', () => {
    expect(ancestorsOf('/main/versión 2/my task')).toEqual(['/main/versión 2', '/main']);
  });
});

describe('destinationGroups', () => {
  const branches = [
    branch('/main', '2010-01-01T00:00:00+01:00'),
    branch('/main/release', '2026-09-01T10:00:00+02:00'),
    branch('/main/release/task', '2026-09-10T10:00:00+02:00'),
    branch('/main/other', '2026-09-20T10:00:00+02:00'),
    branch('/main/older', '2026-08-20T10:00:00+02:00'),
  ];
  const names = (groups: ReturnType<typeof destinationGroups>) => groups.map((group) => [group.title, group.branches.map((each) => each.name)]);

  it("offers the source's ancestors first, nearest first, then every other branch, newest first", () => {
    expect(names(destinationGroups(branches, '/main/release/task'))).toEqual([
      ['Ancestors', ['/main/release', '/main']],
      ['Other branches', ['/main/other', '/main/older']],
    ]);
  });

  it('never offers the source itself', () => {
    expect(names(destinationGroups(branches, '/main/other')).flatMap(([, each]) => each)).not.toContain('/main/other');
  });

  it('never offers a branch made from the source, at any depth, but keeps a sibling whose name starts like it', () => {
    const more = [...branches, branch('/main/release/task/sub', '2026-09-11T10:00:00+02:00'), branch('/main/release-2', '2026-09-12T10:00:00+02:00')];
    expect(names(destinationGroups(more, '/main/release'))).toEqual([
      ['Ancestors', ['/main']],
      ['Other branches', ['/main/other', '/main/release-2', '/main/older']],
    ]);
  });

  it("offers a top-level branch's parent as its ancestor, where its name holds none", () => {
    expect(names(destinationGroups([...branches, branch('/release', '2026-09-30T10:00:00+02:00')], '/release', '/main'))).toEqual([
      ['Ancestors', ['/main']],
      ['Other branches', ['/main/other', '/main/release/task', '/main/release', '/main/older']],
    ]);
  });

  it("leaves out an ancestor the list doesn't have (deleted, or hidden)", () => {
    expect(names(destinationGroups(branches.filter((each) => each.name !== '/main/release'), '/main/release/task'))[0]).toEqual(['Ancestors', ['/main']]);
  });
});
