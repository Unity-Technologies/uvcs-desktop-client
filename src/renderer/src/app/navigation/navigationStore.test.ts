import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));

import { answerConfirms, askedDialogs } from '../../testing/fakeDialogs';
import { guardLeaving, settleBeforeLeaving } from './leaveGuard';
import { navigation, useNavigation } from './navigationStore';
import type { Page, PageOf } from './pages';

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

beforeEach(() => useNavigation.setState({ view: 'changes', pages: [], merge: null }));
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

describe('a merge in progress', () => {
  const merge = (sourceSpec: string): PageOf<'merge'> => ({ kind: 'merge', request: { kind: 'merge', sourceSpec } });
  const fromTask = merge('br:/main/task');

  /** Opens a merge as `navigation.openPage` does, once the user answered whether to drop the one in progress. */
  const openMerge = async (page: PageOf<'merge'>): Promise<void> => useNavigation.getState().openPage(page);

  const shown = (): Page | undefined => useNavigation.getState().pages.at(-1);

  it('is set aside, not closed, when going to another view, and comes back as it was', async () => {
    await openMerge(fromTask);
    const { id } = useNavigation.getState().merge!;
    navigation.goToView('branches');

    expect(useNavigation.getState()).toMatchObject({ view: 'branches', pages: [], merge: { id, page: fromTask } });

    navigation.returnToMerge();

    expect(useNavigation.getState()).toMatchObject({ view: 'branches', pages: [fromTask], merge: { id } });
  });

  it('is set aside when going back from it, and shown again when going back to it from a page about it', async () => {
    await openMerge(fromTask);
    navigation.openPage(history);
    navigation.goBack();

    expect(shown()).toBe(fromTask);

    navigation.goBack();

    expect(useNavigation.getState()).toMatchObject({ pages: [], merge: { page: fromTask } });
  });

  it('closes the pages over the view when going back to it', async () => {
    await openMerge(fromTask);
    navigation.openPage(history);
    navigation.goToView('changes');
    navigation.openPage(browse);
    navigation.returnToMerge();

    expect(useNavigation.getState().pages).toEqual([fromTask]);
  });

  it('goes back to the one in progress when the same merge is opened again, without asking', async () => {
    await openMerge(fromTask);
    const { id } = useNavigation.getState().merge!;
    navigation.goToView('branches');
    await openMerge(merge('br:/main/task'));

    expect(useNavigation.getState()).toMatchObject({ pages: [fromTask], merge: { id } });
    expect(askedDialogs()).toEqual([]);
  });

  it('is replaced by another merge once the user agrees to drop it', async () => {
    await openMerge(fromTask);
    navigation.openPage(history);
    const other = merge('br:/main/other');
    await openMerge(other);

    expect(askedDialogs()).toEqual([{ kind: 'confirm', title: 'Start another merge?' }]);
    expect(useNavigation.getState().pages).toEqual([other]);
  });

  it('stays when the user keeps it rather than starting another merge', async () => {
    await openMerge(fromTask);
    answerConfirms(false);
    await openMerge(merge('br:/main/other'));

    expect(useNavigation.getState()).toMatchObject({ pages: [fromTask], merge: { page: fromTask } });
  });

  it('closes with the pages opened on top of it, and nothing under it', async () => {
    navigation.openPage(browse);
    await openMerge(fromTask);
    navigation.openPage(history);
    navigation.closeMerge();

    expect(useNavigation.getState()).toMatchObject({ pages: [browse], merge: null });
  });

  it('closes as any page once settled: completed, or with nothing to merge', async () => {
    await openMerge(fromTask);
    navigation.settleMerge(useNavigation.getState().merge!.id);
    navigation.goToView('branches');

    expect(useNavigation.getState().merge).toBeNull();
  });

  it('starts another merge without asking once settled', async () => {
    await openMerge(fromTask);
    navigation.settleMerge(useNavigation.getState().merge!.id);
    await openMerge(merge('br:/main/other'));

    expect(askedDialogs()).toEqual([]);
  });

  it("isn't settled by an older merge's page", async () => {
    await openMerge(fromTask);
    const { id } = useNavigation.getState().merge!;
    navigation.closeMerge();
    await openMerge(fromTask);
    navigation.settleMerge(id);

    expect(useNavigation.getState().merge?.settled).toBe(false);
  });
});
