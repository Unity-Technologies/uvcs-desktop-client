import { describe, expect, it } from 'vitest';
import { deleteReviewsQuestion } from './deleteReviewsQuestion';

describe('deleteReviewsQuestion', () => {
  it('keeps the heading short and quotes the title in the message', () => {
    expect(deleteReviewsQuestion(['Fix the boost'])).toEqual({
      title: 'Delete code review?',
      message: '“Fix the boost” will be deleted. The reviewed changes are kept. This cannot be undone.',
    });
  });

  it('cuts a long title at a word, with an ellipsis', () => {
    const long = 'A really long code review title that describes in great detail what the reviewer should focus on when reading';
    const { message } = deleteReviewsQuestion([long]);
    expect(message.startsWith('“A really long code review title that describes in great detail what the reviewer…”')).toBe(true);
  });

  it('counts several reviews', () => {
    expect(deleteReviewsQuestion(['a', 'b']).title).toBe('Delete 2 code reviews?');
  });
});
