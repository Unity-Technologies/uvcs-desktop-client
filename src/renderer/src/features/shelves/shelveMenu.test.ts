import '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { AUTOMATIC_SHELVE_COMMENT } from '@shared/domain/shelve';

const opened = vi.hoisted(() => [] as unknown[][]);
const editing = vi.hoisted(() => [] as unknown[][]);
vi.mock('../codeReviews/CreateCodeReviewDialog', () => ({ openCreateCodeReviewDialog: (...args: unknown[]) => opened.push(args) }));
vi.mock('./shelveOperations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./shelveOperations')>()),
  editShelveComment: async (...args: unknown[]) => void editing.push(args),
}));

import type { Action, MenuEntry } from '../../lib/actions';
import { shelveMenu } from './shelveMenu';

const actions = (entries: MenuEntry[]): Action[] => entries.flatMap((entry) => (typeof entry === 'object' && 'run' in entry ? [entry] : []));

function reviewTitleOf(comment: string): unknown {
  opened.length = 0;
  void actions(shelveMenu(workspacePlace('/ws'), [{ id: 12, comment, repository: 'game@local' }])).find((action) => action.id === 'newCodeReview')!.run();
  return (opened[0]?.[1] as { title?: string } | undefined)?.title;
}

describe('shelveMenu', () => {
  it("titles a code review of the shelve with its comment's summary", () => {
    expect(reviewTitleOf('Spike the new HUD\n\nDetails')).toBe('Spike the new HUD');
  });

  it('skips the blank lines a comment starts with, and reads CRLF as a line end', () => {
    expect(reviewTitleOf('\n\nSpike the new HUD\nDetails')).toBe('Spike the new HUD');
    expect(reviewTitleOf('Spike the new HUD\r\nDetails')).toBe('Spike the new HUD');
  });

  it("edits the user's shelve's comment in a workspace, or in a repository with no workspace", () => {
    const shelve = { id: 12, comment: 'Spike', repository: 'game@local' };
    for (const place of [workspacePlace('/ws'), repositoryPlace('game@local')]) {
      editing.length = 0;
      void actions(shelveMenu(place, [shelve])).find((action) => action.id === 'editComment')!.run();
      expect(editing).toEqual([[place, shelve]]);
    }
  });

  it("leaves someone else's shelve's comment to them, and never edits changes a switch or an update left", () => {
    const offered = (comment: string, options: { mine?: boolean; left?: boolean }): boolean =>
      actions(shelveMenu(workspacePlace('/ws'), [{ id: 12, comment, repository: 'game@local' }], options)).some((action) => action.id === 'editComment');
    expect(offered('Spike', { mine: false })).toBe(false);
    expect(offered('Spike', { left: true })).toBe(false);
    expect(offered(`${AUTOMATIC_SHELVE_COMMENT} (from br:3)`, {})).toBe(false);
  });
});
