import '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

const opened = vi.hoisted(() => [] as unknown[][]);
vi.mock('../codeReviews/CreateCodeReviewDialog', () => ({ openCreateCodeReviewDialog: (...args: unknown[]) => opened.push(args) }));

import type { Action, MenuEntry } from '../../lib/actions';
import { shelveMenu } from './shelveMenu';

const actions = (entries: MenuEntry[]): Action[] => entries.flatMap((entry) => (typeof entry === 'object' && 'run' in entry ? [entry] : []));

function reviewTitleOf(comment: string): unknown {
  opened.length = 0;
  void actions(shelveMenu('/ws', [{ id: 12, comment, repository: 'game@local' }])).find((action) => action.id === 'newCodeReview')!.run();
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
});
