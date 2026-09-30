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
