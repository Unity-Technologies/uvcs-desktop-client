import { beforeEach, describe, expect, it } from 'vitest';
import { useOwnReviewChoiceStore, type OwnReviewPick } from './ownReviewChoiceStore';

const reviewed: OwnReviewPick = { status: 'Reviewed', over: 'Under review' };
const rework: OwnReviewPick = { status: 'Rework required', over: 'Reviewed' };

describe('useOwnReviewChoiceStore', () => {
  beforeEach(() => useOwnReviewChoiceStore.setState({ choices: {} }));

  it("keeps the status picked in a review's popover while it is closed, as the comment beside it is kept", () => {
    useOwnReviewChoiceStore.getState().choose('review 41', reviewed);

    expect(useOwnReviewChoiceStore.getState().choices['review 41']).toEqual(reviewed);
  });

  it('keeps each review its own pick: another review opens on its own', () => {
    const store = useOwnReviewChoiceStore.getState();
    store.choose('review 41', reviewed);
    store.choose('review 42', rework);

    expect(useOwnReviewChoiceStore.getState().choices).toEqual({ 'review 41': reviewed, 'review 42': rework });
  });

  it("drops the pick once sent, and only that review's", () => {
    const store = useOwnReviewChoiceStore.getState();
    store.choose('review 41', reviewed);
    store.choose('review 42', rework);
    store.forget('review 41');

    expect(useOwnReviewChoiceStore.getState().choices).toEqual({ 'review 42': rework });
  });
});
