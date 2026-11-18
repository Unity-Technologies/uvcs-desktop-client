import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { incomingFilesLabel } from './incomingFilesLabel';

const changeset = (id: number): Changeset => ({ id, guid: `guid-${id}`, branch: '/main', comment: '', owner: 'ana', date: '2026-10-01T10:00:00Z', parent: id - 1, repository: 'game@local' });

describe('incomingFilesLabel', () => {
  it('names the whole update', () => {
    expect(incomingFilesLabel({ kind: 'all' })).toBe('Incoming files');
  });

  it('names a changeset by its number', () => {
    expect(incomingFilesLabel({ kind: 'changeset', changesetId: 7 })).toBe('Files changed in cs:7');
  });

  it("names several changesets by their ends", () => {
    const span = [changeset(8), changeset(7), changeset(6)];
    expect(incomingFilesLabel({ kind: 'span', target: { kind: 'range', fromSpec: 'cs:5', toSpec: 'cs:8' }, changesets: span })).toBe('Files changed in cs:6 to cs:8');
  });
});
