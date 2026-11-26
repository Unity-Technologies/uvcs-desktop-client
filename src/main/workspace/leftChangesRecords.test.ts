import { describe, expect, it } from 'vitest';
import type { Shelve } from '@shared/domain/shelve';
import type { ShelveGuid } from '@shared/domain/stableIds';
import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import { branchRefsOf, followingRenames, shelveOf, waitingOn, withShelve, workspaceSpot } from './leftChangesRecords';
import { leftRecord } from './testing/leftRecord';

const ON_TASK1 = { kind: 'branch', name: '/main/task1' } as const;
const SHELVE_GUID = 'c7558622-b4f1-49eb-9f76-639af4d70002' as ShelveGuid;

/** `leftRecord`'s changes, left on branch 37 while it was named /main/old. */
const leftOnOldName = (): SwitchShelveRecord => leftRecord(2, 'br:/main/old');

function shelve(id: number, guid: string): Shelve {
  return { id, guid, comment: '', owner: 'me', date: '', parentChangeset: 1, repository: 'eco@local' };
}

describe('workspaceSpot', () => {
  it('knows a branch by the id the window read, while the workspace is still on it', () => {
    expect(workspaceSpot(ON_TASK1, { known: { name: '/main/task1', id: 37 } })).toEqual({ spec: 'br:/main/task1', name: '/main/task1', objectRef: 'br:37' });
    expect(workspaceSpot(ON_TASK1, { known: { name: '/main/task0', id: 4 } })).toEqual({ spec: 'br:/main/task1', name: '/main/task1' });
  });

  it("knows it by a record's branch that a list already read under the workspace's branch name", () => {
    const nameOf = (id: number) => (id === 37 ? '/main/task1' : undefined);

    expect(workspaceSpot(ON_TASK1, { refs: ['br:5', 'br:37'], nameOf }).objectRef).toBe('br:37');
    expect(workspaceSpot(ON_TASK1, { refs: ['br:5'], nameOf }).objectRef).toBeUndefined();
  });

  it('knows a changeset by its own number, and nothing else without the server', () => {
    expect(workspaceSpot({ kind: 'changeset', name: '12' }, {}).objectRef).toBe('cs:12');
    expect(workspaceSpot({ kind: 'label', name: 'v1' }, {}).objectRef).toBeUndefined();
  });
});

describe('branchRefsOf', () => {
  it('names the branches records were left on or went to, by id', () => {
    const records = [leftRecord(1, 'br:/main/a'), leftRecord(2, 'cs:12', { source: { spec: 'cs:12', name: '12', objectRef: 'cs:12' }, target: { spec: 'br:/main/b', name: '/main/b', objectRef: 'br:8' } })];

    expect(branchRefsOf(records)).toEqual(['br:37', 'br:8']);
  });
});

describe('waitingOn', () => {
  it("doesn't take another branch given the name of the one the changes were left on for it: their ids differ", () => {
    // Left on /main/task1 (37), renamed since; another branch (50) took the name /main/task1.
    const record = leftRecord(2, 'br:/main/task1');

    expect(waitingOn(record, { spec: 'br:/main/task1', name: '/main/task1', objectRef: 'br:50' })).toBeUndefined();
    expect(waitingOn(record, { spec: 'br:/main/task1', name: '/main/task1' })).toMatchObject({ shelveId: 2 });
  });

  it('finds changes left on a branch renamed since by its id', () => {
    const at = { spec: 'br:/main/task1', name: '/main/task1', objectRef: 'br:37' };

    expect(waitingOn(leftOnOldName(), at)).toMatchObject({ shelveId: 2, mode: 'leave' });
    expect(waitingOn(leftOnOldName(), { ...at, objectRef: 'br:4' })).toBeUndefined();
    expect(waitingOn(leftRecord(2, 'br:/main/old', { source: { spec: 'br:/main/old', name: '/main/old', objectRef: '' } }), { ...at, objectRef: undefined })).toBeUndefined();
  });

  it('finds changes being brought on a target renamed since, once its id was learned', () => {
    const bringing = leftRecord(2, 'br:/main/a', { mode: 'bring', target: { spec: 'br:/main/old', name: '/main/old', objectRef: 'br:8' } });

    expect(waitingOn(bringing, { spec: 'br:/main/new', name: '/main/new', objectRef: 'br:8' })).toMatchObject({ mode: 'bring' });
  });
});

describe('followingRenames', () => {
  it('never replaces the id a record holds with the id of a branch that took its name', () => {
    const record = leftRecord(2, 'br:/main/task1');

    expect(followingRenames(record, { spec: 'br:/main/task1', name: '/main/task1', objectRef: 'br:50' })).toBe(record);
  });

  it('fills an id the record lacks', () => {
    const adopted = leftRecord(2, 'br:/main/task1', { source: { spec: 'br:/main/task1', name: '/main/task1', objectRef: '' } });

    expect(followingRenames(adopted, { spec: 'br:/main/task1', name: '/main/task1', objectRef: 'br:37' }).source.objectRef).toBe('br:37');
  });

  it('names where the changes were left as the branch is named now', () => {
    const at = { spec: 'br:/main/task1', name: '/main/task1', objectRef: 'br:37' };

    expect(followingRenames(leftOnOldName(), at).source).toEqual({ spec: 'br:/main/task1', name: '/main/task1', objectRef: 'br:37' });
  });

  it("learns the target's id when the workspace is seen on it, so its rename is followed later", () => {
    const bringing = leftRecord(2, 'br:/main/a', { mode: 'bring', target: { spec: 'br:/main/b', name: '/main/b' } });

    expect(followingRenames(bringing, { spec: 'br:/main/b', name: '/main/b', objectRef: 'br:8' }).target).toEqual({ spec: 'br:/main/b', name: '/main/b', objectRef: 'br:8' });
  });

  it('keeps the same record when nothing was renamed, so nothing is written', () => {
    const record = leftRecord(2, 'br:/main/task1');

    expect(followingRenames(record, { spec: 'br:/main/task1', name: '/main/task1', objectRef: 'br:37' })).toBe(record);
    expect(followingRenames(record, { spec: 'br:/main', name: '/main' })).toBe(record);
  });
});

describe('shelveOf', () => {
  it("finds the record's shelve by its GUID whatever the repository is called now", () => {
    const record = leftRecord(2, 'br:/main/task1', { repository: 'old@local', shelveGuid: SHELVE_GUID });

    expect(shelveOf(record, [shelve(2, SHELVE_GUID)], 'eco@local')?.id).toBe(2);
    expect(shelveOf(record, [shelve(2, 'c7558622-b4f1-49eb-9f76-639af4d70009')], 'eco@local')).toBeUndefined();
  });

  it('finds it by its number in the repository the record names, until its GUID is known', () => {
    const record = leftRecord(2, 'br:/main/task1');

    expect(shelveOf(record, [shelve(2, SHELVE_GUID)], 'eco@local')?.id).toBe(2);
    expect(shelveOf(record, [shelve(2, SHELVE_GUID)], 'other@local')).toBeUndefined();
  });
});

describe('withShelve', () => {
  it('takes the number of the shelve found by its GUID', () => {
    const record = leftRecord(2, 'br:/main/task1', { shelveGuid: SHELVE_GUID });

    expect(withShelve(record, shelve(7, SHELVE_GUID), 'eco@local')).toMatchObject({ shelveId: 7, shelveGuid: SHELVE_GUID });
  });

  it("learns the shelve's GUID and the repository's name now", () => {
    expect(withShelve(leftRecord(2, 'br:/main/task1', { repository: 'old@local' }), shelve(2, SHELVE_GUID.toUpperCase()), 'eco@local')).toMatchObject({
      repository: 'eco@local',
      shelveGuid: SHELVE_GUID,
    });
  });

  it('keeps the same record when nothing changed, and no GUID a cm that prints none gave', () => {
    const known = leftRecord(2, 'br:/main/task1', { shelveGuid: SHELVE_GUID });
    const unknown = leftRecord(2, 'br:/main/task1');

    expect(withShelve(known, shelve(2, SHELVE_GUID), 'eco@local')).toBe(known);
    expect(withShelve(unknown, shelve(2, ''), 'eco@local')).toBe(unknown);
  });
});
