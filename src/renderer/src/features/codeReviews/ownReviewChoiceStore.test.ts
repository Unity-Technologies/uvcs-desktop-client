import { beforeEach, describe, expect, it } from 'vitest';
import { useOwnReviewChoiceStore } from './ownReviewChoiceStore';

describe('useOwnReviewChoiceStore', () => {
  beforeEach(() => useOwnReviewChoiceStore.setState({ choices: {} }));

  it("keeps the status picked in a review's popover while it is closed, as the comment beside it is kept", () => {
    useOwnReviewChoiceStore.getState().choose('review 41', 'Reviewed');

    expect(useOwnReviewChoiceStore.getState().choices['review 41']).toBe('Reviewed');
  });

  it('keeps each review its own pick: another review opens on its own', () => {
    const store = useOwnReviewChoiceStore.getState();
    store.choose('review 41', 'Reviewed');
    store.choose('review 42', 'Rework required');

    expect(useOwnReviewChoiceStore.getState().choices).toEqual({ 'review 41': 'Reviewed', 'review 42': 'Rework required' });
  });

  it("drops the pick once sent, and only that review's", () => {
    const store = useOwnReviewChoiceStore.getState();
    store.choose('review 41', 'Reviewed');
    store.choose('review 42', 'Rework required');
    store.forget('review 41');

    expect(useOwnReviewChoiceStore.getState().choices).toEqual({ 'review 42': 'Rework required' });
  });
});
