import { beforeEach, describe, expect, it } from 'vitest';
import { newLineCommentSpot, type NewLineCommentSpot } from './newLineComment';
import { useNewLineCommentsStore } from './newLineCommentsStore';

const at = (line: number): NewLineCommentSpot => newLineCommentSpot(41, 'src/Player.cs', 'additions', { revisionId: 30, line });

describe('useNewLineCommentsStore', () => {
  beforeEach(() => useNewLineCommentsStore.setState({ spots: [], focusRequest: null, focusSeq: 0 }));

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

  it('asks to focus a comment each time it is opened, and only until it takes the focus', () => {
    const store = useNewLineCommentsStore.getState();
    store.open(at(7));
    const first = useNewLineCommentsStore.getState().focusRequest!;
    expect(first.key).toBe(at(7).key);

    store.focusTaken(first.seq);
    expect(useNewLineCommentsStore.getState().focusRequest).toBeNull();

    store.open(at(7));
    expect(useNewLineCommentsStore.getState().focusRequest).toEqual({ key: at(7).key, seq: first.seq + 1 });
  });

  it("keeps a newer request when an older one's comment takes the focus late", () => {
    const store = useNewLineCommentsStore.getState();
    store.open(at(7));
    const older = useNewLineCommentsStore.getState().focusRequest!.seq;
    store.open(at(9));
    store.focusTaken(older);

    expect(useNewLineCommentsStore.getState().focusRequest?.key).toBe(at(9).key);
  });
});
