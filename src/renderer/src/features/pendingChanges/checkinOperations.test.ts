import { commandFailure, fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dialogs = vi.hoisted(() => ({
  catchUp: undefined as 'updateAndCheckin' | 'review' | undefined,
  asked: [] as unknown[],
  typed: undefined as string | undefined,
}));
vi.mock('./CheckinRejectedDialog', () => ({
  askCatchUpForCheckin: async (request: unknown) => {
    dialogs.asked.push(request);
    return dialogs.catchUp;
  },
}));
vi.mock('../../ui/dialog/prompt', () => ({ prompt: async () => dialogs.typed }));
vi.mock('../../ui/dialog/confirm', () => ({ confirm: async () => true }));

import type { BranchIncomingChanges } from '@shared/domain/incoming';
import type { CheckinResult, PendingChange } from '@shared/domain/pendingChanges';
import type { AppSettings } from '@shared/domain/settings';
import { shownToasts, watchRefreshes, whereTheWindowIs } from '../../testing/operationOutcome';
import { useCheckinAfterUpdateStore } from './checkinAfterUpdate';
import { checkinChanges, shelveChanges } from './checkinOperations';
import { useSuccessMomentStore } from './successMoment';

const ws = '/ws';
const REJECTED = "MERGE_NEEDED A merge is needed from changeset 'cs:43@rep:game@repserver:local' to changeset 'cs:41@rep:game@repserver:local' in order to checkin.";

const change = (path: string, kinds: PendingChange['kinds'] = ['checkedOut', 'changed']): PendingChange => ({ path, kinds, itemType: 'file', size: 1, lastModified: '' });
const created = (changesetId: number): CheckinResult => ({ kind: 'created', changesetId, branch: '/main' });

function incoming(overrides: Partial<BranchIncomingChanges> = {}): BranchIncomingChanges {
  return {
    branch: '/main',
    loadedChangeset: 41,
    headChangeset: 43,
    changesetCount: 1,
    authors: ['bob'],
    changesets: [{ id: 43, guid: 'g', branch: '/main', comment: 'Fix', owner: 'bob', date: '', parent: 41, repository: 'game@local' }],
    files: [{ status: 'changed', path: 'src/other.ts', itemType: 'file', baseRevisionId: 1, revisionId: 2, repository: 'game@local' }],
    conflicts: [],
    blockedPaths: [],
    ...overrides,
  };
}

/** The server answers checkins in turn: a rejection is a failed `cm checkin` naming where the branch head went. */
function answerCheckins(...answers: (CheckinResult | 'rejected')[]): void {
  fakeApi.answer('pendingChanges.checkin', () => {
    const answer = answers.shift();
    if (answer === 'rejected') throw commandFailure(REJECTED, 'cm checkin');
    if (!answer) throw new Error('No more checkins expected');
    return answer;
  });
}

let settings: Pick<AppSettings, 'recentComments'>;
function answerSettings(recentComments: string[] = []): void {
  settings = { recentComments };
  fakeApi.answer('settings.get', () => settings);
  fakeApi.answer('settings.update', (update: Partial<AppSettings>) => (settings = { ...settings, ...update }));
}

beforeEach(() => {
  dialogs.catchUp = undefined;
  dialogs.asked = [];
  dialogs.typed = undefined;
  useCheckinAfterUpdateStore.setState({ rejected: {} });
  useSuccessMomentStore.setState({ moments: {} });
});

describe('checkinChanges', () => {
  it('checks in the paths with the comment, celebrates the changeset and remembers the comment', async () => {
    answerCheckins(created(44));
    answerSettings();

    expect(await checkinChanges({ workspacePath: ws, changes: [change('src/a.ts'), change('src/b.ts')], comment: 'Add login\n\nDetails' })).toBe(true);

    expect(fakeApi.argsOf('pendingChanges.checkin')[0]!.slice(0, 2)).toEqual([ws, { paths: ['src/a.ts', 'src/b.ts'], comment: 'Add login\n\nDetails' }]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Checked in cs:44 on /main', action: 'View' }]);
    expect(useSuccessMomentStore.getState().moments[ws]).toMatchObject({ verb: 'Checked in', changesetId: 44, detail: 'Add login' });
    expect(settings.recentComments).toEqual(['Add login\n\nDetails']);
  });

  it('shows no toast when told to be quiet: the empty Changes tells it', async () => {
    answerCheckins(created(44));
    answerSettings();

    await checkinChanges({ workspacePath: ws, changes: [change('a.ts')], comment: 'x', quiet: true });

    expect(shownToasts()).toEqual([]);
  });

  it('keeps the 15 latest comments, the newest first and each once', async () => {
    const older = Array.from({ length: 15 }, (_, index) => `comment ${index}`);
    answerCheckins(created(44));
    answerSettings(older);

    await checkinChanges({ workspacePath: ws, changes: [change('a.ts')], comment: '  comment 3 ' });

    expect(settings.recentComments).toEqual(['comment 3', ...older.filter((comment) => comment !== 'comment 3')]);
    answerCheckins(created(45));
    await checkinChanges({ workspacePath: ws, changes: [change('a.ts')], comment: 'new' });
    expect(settings.recentComments).toHaveLength(15);
    expect(settings.recentComments[0]).toBe('new');
  });

  it('remembers no empty comment', async () => {
    answerCheckins(created(44));

    await checkinChanges({ workspacePath: ws, changes: [change('a.ts')], comment: '  ' });

    expect(fakeApi.methods()).toEqual(['pendingChanges.checkin']);
  });

  it('refreshes what a checkin changes, not the objects checkins leave alone', async () => {
    answerCheckins(created(44));
    answerSettings();
    const refreshed = watchRefreshes(ws);

    await checkinChanges({ workspacePath: ws, changes: [change('a.ts')], comment: 'x' });

    expect(refreshed()).toEqual(['annotate', 'branchExplorer', 'branches', 'changesets', 'explorer', 'history', 'incoming', 'info', 'locks', 'pendingChanges', 'review']);
  });

  it('says "Nothing to check in" when only checkouts without edits went in, and keeps the comment for a real one', async () => {
    answerCheckins({ kind: 'noChanges' });

    const checkedIn = await checkinChanges({ workspacePath: ws, changes: [change('a.ts', ['checkedOut']), change('b.ts', ['checkedOut'])], comment: 'x' });

    expect(checkedIn).toBe(false);
    expect(shownToasts()).toEqual([{ kind: 'info', title: 'Nothing to check in', detail: 'Released 2 checkouts without edits.' }]);
    expect(useSuccessMomentStore.getState().moments[ws]).toBeUndefined();
    expect(fakeApi.methods()).toEqual(['pendingChanges.checkin']);
  });

  it('fails when changes with content went in and no changeset came out', async () => {
    answerCheckins({ kind: 'noChanges' });

    expect(await checkinChanges({ workspacePath: ws, changes: [change('a.ts')], comment: 'x' })).toBe(false);

    expect(shownToasts()).toEqual([{ kind: 'error', title: 'Checking in 1 change failed', detail: 'The checkin finished but no changeset was created.' }]);
  });

  it('reports any other failure as an error, without asking to catch up', async () => {
    fakeApi.answer('pendingChanges.checkin', () => {
      throw commandFailure('The item is locked by ana');
    });

    expect(await checkinChanges({ workspacePath: ws, changes: [change('a.ts')], comment: 'x' })).toBe(false);

    expect(shownToasts()).toEqual([{ kind: 'error', title: 'Checking in 1 change failed', detail: 'The item is locked by ana' }]);
    expect(dialogs.asked).toEqual([]);
  });
});

describe('checkinChanges after the branch moved on (rejected by cm)', () => {
  it('asks, then updates and checks in again the same files with the same comment', async () => {
    answerCheckins('rejected', created(44));
    answerSettings();
    fakeApi.answer('merge.incomingChanges', () => incoming());
    fakeApi.answer('workspaces.update', () => undefined);
    dialogs.catchUp = 'updateAndCheckin';

    expect(await checkinChanges({ workspacePath: ws, changes: [change('src/a.ts')], comment: 'Mine' })).toBe(true);

    expect(dialogs.asked).toEqual([{ incoming: incoming(), overlapping: [], needsReview: false, rejected: true }]);
    expect(fakeApi.methods()).toEqual(['pendingChanges.checkin', 'merge.incomingChanges', 'workspaces.update', 'pendingChanges.checkin', 'settings.get', 'settings.update']);
    const [first, second] = fakeApi.argsOf('pendingChanges.checkin');
    expect(second![1]).toEqual(first![1]);
    expect(shownToasts().some((toast) => toast.kind === 'error')).toBe(false);
  });

  it('asks for review when what came in touches the same files', async () => {
    answerCheckins('rejected');
    fakeApi.answer('merge.incomingChanges', () => incoming({ files: [{ status: 'changed', path: 'src/a.ts', itemType: 'file', baseRevisionId: 1, revisionId: 2, repository: 'game@local' }] }));

    await checkinChanges({ workspacePath: ws, changes: [change('src/a.ts')], comment: 'x' });

    expect(dialogs.asked).toMatchObject([{ overlapping: ['src/a.ts'], needsReview: true, rejected: true }]);
  });

  it('on review, goes to Incoming and remembers where the workspace was, so Changes offers the checkin after updating', async () => {
    answerCheckins('rejected');
    fakeApi.answer('merge.incomingChanges', () => incoming({ loadedChangeset: 40 }));
    dialogs.catchUp = 'review';

    expect(await checkinChanges({ workspacePath: ws, changes: [change('src/a.ts')], comment: 'x' })).toBe(false);

    expect(whereTheWindowIs().view).toBe('incoming');
    // Where cm said the workspace was when it refused, not where the incoming check read it later.
    expect(useCheckinAfterUpdateStore.getState().rejected[ws]).toEqual({ branch: '/main', loadedChangeset: 41 });
    expect(fakeApi.methods()).not.toContain('workspaces.update');
  });

  it('does nothing more when the dialog is cancelled', async () => {
    answerCheckins('rejected');
    fakeApi.answer('merge.incomingChanges', () => incoming());

    expect(await checkinChanges({ workspacePath: ws, changes: [change('src/a.ts')], comment: 'x' })).toBe(false);

    expect(fakeApi.methods()).toEqual(['pendingChanges.checkin', 'merge.incomingChanges']);
    expect(whereTheWindowIs().view).toBe('changes');
  });

  it('checks in no more when the update fails', async () => {
    answerCheckins('rejected');
    fakeApi.answer('merge.incomingChanges', () => incoming());
    fakeApi.answer('workspaces.update', () => {
      throw new Error('disk full');
    });
    dialogs.catchUp = 'updateAndCheckin';

    expect(await checkinChanges({ workspacePath: ws, changes: [change('src/a.ts')], comment: 'x' })).toBe(false);

    expect(fakeApi.argsOf('pendingChanges.checkin')).toHaveLength(1);
  });

  it('shows no error toast for the rejection itself: the dialog explains it', async () => {
    answerCheckins('rejected');
    fakeApi.answer('merge.incomingChanges', () => incoming());

    await checkinChanges({ workspacePath: ws, changes: [change('src/a.ts')], comment: 'x' });

    expect(shownToasts()).toEqual([]);
  });
});

describe('checkinChanges with "Update & check in" (updateFirst)', () => {
  it('updates and checks in without asking when nothing overlaps', async () => {
    answerCheckins(created(44));
    answerSettings();
    fakeApi.answer('merge.incomingChanges', () => incoming());
    fakeApi.answer('workspaces.update', () => undefined);

    expect(await checkinChanges({ workspacePath: ws, changes: [change('src/a.ts')], comment: 'x', updateFirst: true })).toBe(true);

    expect(dialogs.asked).toEqual([]);
    expect(fakeApi.methods().slice(0, 3)).toEqual(['merge.incomingChanges', 'workspaces.update', 'pendingChanges.checkin']);
  });

  it('asks first when updating needs a decision: conflicts or blocked files', async () => {
    fakeApi.answer('merge.incomingChanges', () => incoming({ blockedPaths: ['src/moved.ts'] }));

    await checkinChanges({ workspacePath: ws, changes: [change('src/a.ts')], comment: 'x', updateFirst: true });

    expect(dialogs.asked).toMatchObject([{ needsReview: true, rejected: false }]);
    expect(fakeApi.methods()).toEqual(['merge.incomingChanges']);
  });

  it('checks in right away when the workspace was updated meanwhile', async () => {
    answerCheckins(created(44));
    answerSettings();
    fakeApi.answer('merge.incomingChanges', () => incoming({ changesets: [], changesetCount: 0 }));

    expect(await checkinChanges({ workspacePath: ws, changes: [change('src/a.ts')], comment: 'x', updateFirst: true })).toBe(true);

    expect(dialogs.asked).toEqual([]);
    expect(fakeApi.methods()).not.toContain('workspaces.update');
  });

  it('on review, remembers where the incoming check found the workspace', async () => {
    fakeApi.answer('merge.incomingChanges', () => incoming({ files: [{ status: 'deleted', path: 'src', itemType: 'directory', baseRevisionId: 1, revisionId: -1, repository: 'game@local' }] }));
    dialogs.catchUp = 'review';

    await checkinChanges({ workspacePath: ws, changes: [change('src/a.ts')], comment: 'x', updateFirst: true });

    expect(useCheckinAfterUpdateStore.getState().rejected[ws]).toEqual({ branch: '/main', loadedChangeset: 41 });
  });

  it('checks in nothing when the incoming changes cannot be read', async () => {
    fakeApi.answer('merge.incomingChanges', () => {
      throw new Error('offline');
    });

    expect(await checkinChanges({ workspacePath: ws, changes: [change('src/a.ts')], comment: 'x', updateFirst: true })).toBe(false);

    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't check what came in", detail: 'offline' }]);
  });

  it('forgets an earlier rejection once a checkin went in', async () => {
    useCheckinAfterUpdateStore.getState().remember(ws, { branch: '/main', loadedChangeset: 30 });
    answerCheckins(created(44));
    answerSettings();

    await checkinChanges({ workspacePath: ws, changes: [change('a.ts')], comment: 'x' });

    expect(useCheckinAfterUpdateStore.getState().rejected[ws]).toBeUndefined();
  });
});

describe('shelveChanges', () => {
  it('shelves away (and undoes) by default, refreshing the shelves and the workspace', async () => {
    fakeApi.answer('pendingChanges.shelveAndUndo', () => ({ shelveId: 7, count: 2 }));
    const refreshed = watchRefreshes(ws);

    expect(await shelveChanges(ws, [change('a.ts'), change('b.ts')], ' WIP ', false)).toBe(true);

    expect(fakeApi.argsOf('pendingChanges.shelveAndUndo')[0]!.slice(0, 3)).toEqual([ws, ['a.ts', 'b.ts'], 'WIP']);
    expect(refreshed()).toEqual(['info', 'pendingChanges', 'review', 'shelves']);
  });

  it('keeps the changes in the workspace when asked, refreshing only the shelves', async () => {
    fakeApi.answer('pendingChanges.shelve', () => 8);
    const refreshed = watchRefreshes(ws);

    expect(await shelveChanges(ws, [change('a.ts')], 'WIP', true)).toBe(true);

    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Shelved as shelve 8', detail: 'Your changes are still in the workspace.' }]);
    expect(refreshed()).toEqual(['shelves']);
  });

  it('asks for a comment when there is none, and shelves nothing without one', async () => {
    expect(await shelveChanges(ws, [change('a.ts')], '', true)).toBe(false);
    expect(fakeApi.methods()).toEqual([]);

    dialogs.typed = 'Typed';
    fakeApi.answer('pendingChanges.shelve', () => 9);
    await shelveChanges(ws, [change('a.ts')], '', true);
    expect(fakeApi.argsOf('pendingChanges.shelve')[0]![2]).toBe('Typed');
  });

  it('tells a failed shelve apart from a created one', async () => {
    fakeApi.answer('pendingChanges.shelve', () => {
      throw new Error('no space');
    });

    expect(await shelveChanges(ws, [change('a.ts')], 'WIP', true)).toBe(false);
  });
});

