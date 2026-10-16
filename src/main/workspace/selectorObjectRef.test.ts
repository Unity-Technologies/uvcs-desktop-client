import { describe, expect, it } from 'vitest';
import { FOUND_BRANCHES, FOUND_LABELS } from '../cm/foundObjects';
import { branchesFound, foundLine, foundOutput } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { selectorObjectRef } from './selectorObjectRef';

const LABEL_V1 = foundOutput(FOUND_LABELS, { id: 812, name: 'v1', changeset: 12, branch: '/main', owner: 'me', date: '2026-09-25T23:16:33.0000000+02:00', repname: 'eco', repserver: 'local' });

describe('selectorObjectRef', () => {
  it('names a changeset by its number, asking nothing', async () => {
    const { cm, lines } = fakeCmClient({});
    expect(await selectorObjectRef(cm, '/work', { kind: 'changeset', name: '12' })).toBe('cs:12');
    expect(lines()).toEqual([]);
  });

  it('names a branch by its object id, picking it among the branches cm matches by the last part of the name', async () => {
    const { cm, lines } = fakeCmClient({ 'find branch': branchesFound({ name: '/main/other/task1', id: 41 }, { name: '/main/task1', id: 37 }) });

    expect(await selectorObjectRef(cm, '/work', { kind: 'branch', name: '/main/task1' })).toBe('br:37');
    expect(lines()).toEqual([foundLine(FOUND_BRANCHES, "where name = 'task1'")]);
  });

  it("looks a name holding a quote up with a wildcard in its place, and takes only the object of that very name", async () => {
    const { cm, lines } = fakeCmClient({ 'find branch': branchesFound({ name: '/main/ana-s', id: 41 }), 'find label': LABEL_V1 });

    expect(await selectorObjectRef(cm, '/work', { kind: 'branch', name: "/main/ana's" })).toBeNull();
    expect(await selectorObjectRef(cm, '/work', { kind: 'label', name: "v'1" })).toBeNull();
    expect(lines()).toEqual([foundLine(FOUND_BRANCHES, "where name like 'ana%s'"), foundLine(FOUND_LABELS, "where name like 'v%1'")]);
  });

  it('names a label by its object id', async () => {
    const { cm } = fakeCmClient({ 'find label': LABEL_V1 });
    expect(await selectorObjectRef(cm, '/work', { kind: 'label', name: 'v1' })).toBe('lb:812');
  });

  it('names nothing it cannot find, and never a shelve: changes are never left on one', async () => {
    const { cm } = fakeCmClient({ 'find branch': '', 'find label': '' });
    expect(await selectorObjectRef(cm, '/work', { kind: 'branch', name: '/main/gone' })).toBeNull();
    expect(await selectorObjectRef(cm, '/work', { kind: 'label', name: 'gone' })).toBeNull();
    expect(await selectorObjectRef(cm, '/work', { kind: 'shelve', name: '4' })).toBeNull();
  });
});
