import { describe, expect, it } from 'vitest';
import { branchesFound, NOTHING_FOUND } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { selectorObjectRef } from './selectorObjectRef';

const LABEL_V1 = `<?xml version="1.0" encoding="utf-8" ?><PLASTICQUERY><LABEL><ID>812</ID><NAME>v1</NAME><CHANGESET>12</CHANGESET><BRANCH>/main</BRANCH><COMMENT></COMMENT><OWNER>me</OWNER><DATE>2026-09-25T23:16:33+02:00</DATE><REPNAME>eco</REPNAME><REPSERVER>local</REPSERVER></LABEL></PLASTICQUERY>`;

describe('selectorObjectRef', () => {
  it('names a changeset by its number, asking nothing', async () => {
    const { cm, lines } = fakeCmClient({});
    expect(await selectorObjectRef(cm, '/work', { kind: 'changeset', name: '12' })).toBe('cs:12');
    expect(lines()).toEqual([]);
  });

  it('names a branch by its object id, picking it among the branches cm matches by the last part of the name', async () => {
    const { cm, lines } = fakeCmClient({ 'find branch': branchesFound({ name: '/main/other/task1', id: 41 }, { name: '/main/task1', id: 37 }) });

    expect(await selectorObjectRef(cm, '/work', { kind: 'branch', name: '/main/task1' })).toBe('br:37');
    expect(lines()).toEqual(["find branch where name = 'task1' --xml --nototal"]);
  });

  it("looks a name holding a quote up with a wildcard in its place, and takes only the object of that very name", async () => {
    const { cm, lines } = fakeCmClient({ 'find branch': branchesFound({ name: '/main/ana-s', id: 41 }), 'find label': LABEL_V1 });

    expect(await selectorObjectRef(cm, '/work', { kind: 'branch', name: "/main/ana's" })).toBeNull();
    expect(await selectorObjectRef(cm, '/work', { kind: 'label', name: "v'1" })).toBeNull();
    expect(lines()).toEqual(["find branch where name like 'ana%s' --xml --nototal", "find label where name like 'v%1' --xml --nototal"]);
  });

  it('names a label by its object id', async () => {
    const { cm } = fakeCmClient({ 'find label': LABEL_V1 });
    expect(await selectorObjectRef(cm, '/work', { kind: 'label', name: 'v1' })).toBe('lb:812');
  });

  it('names nothing it cannot find, and never a shelve: changes are never left on one', async () => {
    const { cm } = fakeCmClient({ 'find branch': NOTHING_FOUND, 'find label': NOTHING_FOUND });
    expect(await selectorObjectRef(cm, '/work', { kind: 'branch', name: '/main/gone' })).toBeNull();
    expect(await selectorObjectRef(cm, '/work', { kind: 'label', name: 'gone' })).toBeNull();
    expect(await selectorObjectRef(cm, '/work', { kind: 'shelve', name: '4' })).toBeNull();
  });
});
