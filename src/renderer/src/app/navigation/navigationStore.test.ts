import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { guardLeaving, settleBeforeLeaving } from './leaveGuard';
import { navigation, useNavigation } from './navigationStore';
import type { Page } from './pages';

const history: Page = { kind: 'history', path: 'src/a.cs' };
const browse: Page = { kind: 'browseRepository', changesetId: 12 };

let liftGuard = (): void => {};

/** Guards the way out as a file with unsaved edits does, answering what the user would. */
function guardWith(canLeave: boolean): { asked: number } {
  const guard = { asked: 0 };
  liftGuard = guardLeaving(async () => {
    guard.asked++;
    return canLeave;
  });
  return guard;
}

beforeEach(() => useNavigation.setState({ view: 'changes', pages: [] }));
afterEach(() => liftGuard());

describe('navigation', () => {
  it('stacks pages over the view and goes back one at a time', () => {
    navigation.openPage(history);
    navigation.openPage(browse);
    navigation.goBack();

    expect(useNavigation.getState()).toMatchObject({ view: 'changes', pages: [history] });
  });

  it('shows a page in place of the one on top, so Back goes to the one before', () => {
    navigation.openPage(history);
    navigation.openPage(browse);
    const moved: Page = { kind: 'browseRepository', changesetId: 12, focusPath: 'src/a.cs' };
    navigation.replacePage(moved);

    expect(useNavigation.getState().pages).toEqual([history, moved]);
    navigation.goBack();
    expect(useNavigation.getState().pages).toEqual([history]);
  });

  it("goes to a place in the review on top within its page, as its tabs do: a comment's file in the conversation", () => {
    // Opened as another page, it stacked "Code review 41 / Code review 41", and the review drew again, its
    // conversation's scroll lost. One page in place keeps the stack's length, the page's key (`PageFrame`).
    const conversation: Page = { kind: 'codeReview', reviewId: 41 };
    const atComment: Page = { kind: 'codeReview', reviewId: 41, tab: 'changes', focusPath: 'Assets/Retry.cs', focusThread: 51 };
    navigation.openPage(history);
    navigation.openPage(conversation);
    navigation.openPage(atComment);

    expect(useNavigation.getState().pages).toEqual([history, atComment]);
  });

  it('opens another review over the one on top, Back returning to it', () => {
    const review: Page = { kind: 'codeReview', reviewId: 41 };
    const another: Page = { kind: 'codeReview', reviewId: 72 };
    navigation.openPage(review);
    navigation.openPage(another);

    expect(useNavigation.getState().pages).toEqual([review, another]);
  });

  it('opens a page shown in place when none is open', () => {
    navigation.replacePage(history);

    expect(useNavigation.getState().pages).toEqual([history]);
  });

  it('stays on the view when going back with no page open', () => {
    navigation.goBack();

    expect(useNavigation.getState()).toMatchObject({ view: 'changes', pages: [] });
  });

  it('closes every page when going to another view', () => {
    navigation.openPage(history);
    navigation.goToView('branches');

    expect(useNavigation.getState()).toMatchObject({ view: 'branches', pages: [] });
  });

  it('closes the pages without asking when going to the view already shown', () => {
    const guard = guardWith(false);
    navigation.openPage(history);
    navigation.goToView('changes');

    expect(useNavigation.getState().pages).toEqual([]);
    expect(guard.asked).toBe(0);
  });

  it('goes to another view once unsaved edits are settled', async () => {
    guardWith(true);
    navigation.goToView('branches');
    await settleBeforeLeaving();

    expect(useNavigation.getState().view).toBe('branches');
  });

  it('stays on the view when the user cancels leaving it', async () => {
    guardWith(false);
    navigation.openPage(history);
    navigation.goToView('branches');
    await settleBeforeLeaving();

    expect(useNavigation.getState()).toMatchObject({ view: 'changes', pages: [history] });
  });
});
