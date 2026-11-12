import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { newChangesetsSpan } from './newChangesetsSpan';

const changeset = (id: number): Changeset => ({ id, guid: `guid-${id}`, branch: '/main/task', comment: '', owner: 'dani', date: `2026-11-${id}T10:00:00+01:00`, parent: id - 1, repository: 'game@local' });
const branch = [changeset(17), changeset(16), changeset(15), changeset(14)];

describe('newChangesetsSpan', () => {
  it('spans the changesets checked in since the checkpoint, oldest to newest', () => {
    expect(newChangesetsSpan(branch, { date: '2026-11-15T12:00:00+01:00', status: 'Rework required', changesetId: 15 })).toEqual({ oldest: 16, newest: 17 });
  });

  it('spans one changeset when only one came since', () => {
    expect(newChangesetsSpan(branch, { date: '2026-11-16T12:00:00+01:00', status: 'Rework required', changesetId: 16 })).toEqual({ oldest: 17, newest: 17 });
  });

  it('spans the whole branch for a status given before its first changeset', () => {
    expect(newChangesetsSpan(branch, { date: '2026-11-01T12:00:00+01:00', status: 'Reviewed' })).toEqual({ oldest: 14, newest: 17 });
  });

  it('is none when nothing came since, without a checkpoint, or while the changesets are read', () => {
    expect(newChangesetsSpan(branch, { date: '2026-11-18T12:00:00+01:00', status: 'Reviewed', changesetId: 17 })).toBeUndefined();
    expect(newChangesetsSpan(branch, undefined)).toBeUndefined();
    expect(newChangesetsSpan(undefined, { date: '2026-11-01T12:00:00+01:00', status: 'Reviewed' })).toBeUndefined();
  });
});
