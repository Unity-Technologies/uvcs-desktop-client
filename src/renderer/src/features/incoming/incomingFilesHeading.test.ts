import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { incomingFilesHeading } from './incomingFilesHeading';

const changeset = (id: number, comment = ''): Changeset => ({ id, guid: `guid-${id}`, branch: '/main', comment, owner: 'ana', date: '2026-10-01T10:00:00Z', parent: id - 1, repository: 'game@local' });

describe('incomingFilesHeading', () => {
  it('names the whole update, which nothing narrows', () => {
    expect(incomingFilesHeading({ kind: 'all' }, undefined)).toEqual({ title: 'All incoming changes', listLabel: 'Incoming files', narrowed: false });
  });

  it("names a changeset by its number and its comment's first line, the line in the tooltip", () => {
    expect(incomingFilesHeading({ kind: 'changeset', changesetId: 7 }, changeset(7, 'Fix the jump\n\nIt was too high'))).toEqual({
      title: 'cs:7 · Fix the jump',
      tip: 'Fix the jump',
      listLabel: 'Files changed in cs:7',
      narrowed: true,
    });
  });

  it('says a changeset has no comment, with no tooltip', () => {
    expect(incomingFilesHeading({ kind: 'changeset', changesetId: 7 }, changeset(7, '  '))).toEqual({ title: 'cs:7 · No comment', listLabel: 'Files changed in cs:7', narrowed: true });
  });

  it('counts several changesets and names their ends', () => {
    const span = [changeset(8), changeset(7), changeset(6)];
    expect(incomingFilesHeading({ kind: 'span', target: { kind: 'range', fromSpec: 'cs:5', toSpec: 'cs:8' }, changesets: span }, undefined)).toEqual({
      title: '3 changesets · cs:6 to cs:8',
      listLabel: 'Files changed in cs:6 to cs:8',
      narrowed: true,
    });
  });
});
