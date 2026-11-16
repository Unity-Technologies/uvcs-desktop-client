import { describe, expect, it } from 'vitest';
import { deleteReviewsQuestion } from './deleteReviewsQuestion';

describe('deleteReviewsQuestion', () => {
  it('keeps the heading short and quotes the title in the message', () => {
    expect(deleteReviewsQuestion([{ title: 'Fix the boost' }])).toEqual({
      title: 'Delete code review?',
      message: '“Fix the boost” will be deleted. The reviewed changes are kept. This cannot be undone.',
    });
  });

  it('cuts a long title at a word, with an ellipsis', () => {
    const long = 'A really long code review title that describes in great detail what the reviewer should focus on when reading';
    const { message } = deleteReviewsQuestion([{ title: long }]);
    expect(message.startsWith('“A really long code review title that describes in great detail what the reviewer…”')).toBe(true);
  });

  it('counts several reviews', () => {
    expect(deleteReviewsQuestion([{ title: 'a' }, { title: 'b' }]).title).toBe('Delete 2 code reviews?');
  });

  it('names merge requests as such, and a mix as reviews', () => {
    const request = { title: 'Add login', mergeRequest: { state: 'Open' as const, destination: '/main' } };
    expect(deleteReviewsQuestion([request]).title).toBe('Delete merge request?');
    expect(deleteReviewsQuestion([request, request]).title).toBe('Delete 2 merge requests?');
    expect(deleteReviewsQuestion([request, { title: 'b' }]).title).toBe('Delete 2 reviews?');
  });
});
