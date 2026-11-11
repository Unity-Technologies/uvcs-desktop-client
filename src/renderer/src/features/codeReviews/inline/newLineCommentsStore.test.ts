import { beforeEach, describe, expect, it } from 'vitest';
import { newLineCommentKey, type NewLineCommentSpot } from './newLineComment';
import { useNewLineCommentsStore } from './newLineCommentsStore';

const at = (line: number): NewLineCommentSpot => {
  const comment = { revisionId: 30, line, kind: 'changeRequest' as const };
  return { key: newLineCommentKey(41, comment), reviewId: 41, side: 'additions', comment };
};

describe('useNewLineCommentsStore', () => {
  beforeEach(() => useNewLineCommentsStore.setState({ spots: [] }));

  it('starts one comment per line: a second "+" on it keeps the one being written, and its kind', () => {
    const store = useNewLineCommentsStore.getState();
    store.open(at(7));
    store.setKind(at(7).key, 'question');
    store.open(at(7));
    store.open(at(9));

    expect(useNewLineCommentsStore.getState().spots.map((spot) => [spot.comment.line, spot.comment.kind])).toEqual([
      [7, 'question'],
      [9, 'changeRequest'],
    ]);
  });

  it('drops a comment sent or canceled, and only that one', () => {
    const store = useNewLineCommentsStore.getState();
    store.open(at(7));
    store.open(at(9));
    store.close(at(7).key);

    expect(useNewLineCommentsStore.getState().spots).toEqual([at(9)]);
  });
});
