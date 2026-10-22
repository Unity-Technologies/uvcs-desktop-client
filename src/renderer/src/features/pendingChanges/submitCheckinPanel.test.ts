import '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const steps = vi.hoisted(() => ({
  settled: true,
  checkedIn: true,
  shelved: true,
  checkins: [] as unknown[],
  shelves: [] as unknown[],
}));
vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));
vi.mock('../../app/navigation/leaveGuard', () => ({ settleBeforeLeaving: async () => steps.settled }));
vi.mock('./checkinOperations', () => ({
  checkinChanges: async (options: unknown) => {
    steps.checkins.push(options);
    return steps.checkedIn;
  },
  shelveChanges: async (options: unknown) => {
    steps.shelves.push(options);
    return steps.shelved;
  },
}));

import type { PendingChange } from '@shared/domain/pendingChanges';
import { answerConfirms, askedDialogs } from '../../testing/fakeDialogs';
import { bulkPrivateFiles } from './bulkPrivate';
import { checkinDraftOf, useCheckinDraftStore } from './checkinDraftStore';
import { checkinFromPanel, shelveFromPanel, type PanelCheckin, type PanelShelve } from './submitCheckinPanel';

const ws = '/ws';
const change = (path: string, kinds: PendingChange['kinds'] = ['checkedOut', 'changed']): PendingChange => ({ path, kinds, itemType: 'file', size: 1, lastModified: '' });
const included = [change('src/a.ts'), change('src/b.ts')];
const allChanges = [...included, change('src/c.ts')];
const folder = (path: string, kinds: PendingChange['kinds']): PendingChange => ({ path, kinds, itemType: 'directory', size: 0, lastModified: '' });
// A moved folder goes in with everything under it: cm takes all that's under a path.
const moved = folder('lib', ['moved']);
const insideMoved = change('lib/b.cs', ['changed']);

function panelCheckin(overrides: Partial<PanelCheckin> = {}): PanelCheckin {
  return { workspacePath: ws, included, hiddenIncludedCount: 0, allChanges, behind: false, bulkPrivate: null, warnOnEmptyComment: true, ...overrides };
}

function panelShelve(overrides: Partial<PanelShelve> = {}): PanelShelve {
  return { workspacePath: ws, shelvable: included, hiddenIncludedCount: 0, allChanges, ...overrides };
}

function writeComment(summary: string, description = ''): void {
  useCheckinDraftStore.getState().setMessage(ws, { summary, description });
}

beforeEach(() => {
  Object.assign(steps, { settled: true, checkedIn: true, shelved: true, checkins: [], shelves: [] });
  useCheckinDraftStore.setState({ drafts: {} });
});

describe('checkinFromPanel', () => {
  it("checks in the included changes with the draft's comment, then clears the comment", async () => {
    writeComment('Add login', 'Details');

    expect(await checkinFromPanel(panelCheckin({ behind: true }))).toBe('checkedIn');

    expect(steps.checkins).toEqual([
      { workspacePath: ws, changes: included, paths: ['src/a.ts', 'src/b.ts'], addsPrivate: false, comment: 'Add login\n\nDetails', updateFirst: true, quiet: false },
    ]);
    expect(checkinDraftOf(ws)).toMatchObject({ summary: '', description: '' });
    expect(askedDialogs()).toEqual([]);
  });

  it('checks in quietly when every pending change goes in: the empty Changes tells it', async () => {
    writeComment('All of it');

    await checkinFromPanel(panelCheckin({ allChanges: included }));

    expect(steps.checkins).toMatchObject([{ quiet: true }]);
  });

  it('asks before checking in without a comment, and leads to writing one when the user declines', async () => {
    answerConfirms(false);

    expect(await checkinFromPanel(panelCheckin())).toBe('writeComment');

    expect(askedDialogs()).toEqual([{ kind: 'confirm', title: 'Check in without a comment?' }]);
    expect(steps.checkins).toEqual([]);
  });

  it('checks in without a comment once confirmed, or at once when the setting says not to ask', async () => {
    answerConfirms(true);
    expect(await checkinFromPanel(panelCheckin())).toBe('checkedIn');

    expect(await checkinFromPanel(panelCheckin({ warnOnEmptyComment: false }))).toBe('checkedIn');
    expect(askedDialogs()).toHaveLength(1);
  });

  it('checks nothing in while unsaved edits keep it waiting', async () => {
    writeComment('Fix');
    steps.settled = false;

    expect(await checkinFromPanel(panelCheckin())).toBe('notCheckedIn');

    expect(steps.checkins).toEqual([]);
  });

  it('asks before checking in a pile of private files', async () => {
    writeComment('Fix');
    const privateFiles = Array.from({ length: 60 }, (_, index) => change(`gen/file${index}.cs`, ['private']));
    answerConfirms(false);

    expect(await checkinFromPanel(panelCheckin({ bulkPrivate: bulkPrivateFiles(privateFiles) }))).toBe('notCheckedIn');

    expect(askedDialogs()).toEqual([{ kind: 'confirm', title: 'Check in 60 private files?' }]);
    expect(steps.checkins).toEqual([]);
  });

  it('asks before a folder takes unchecked changes inside it along, and checks nothing in when declined', async () => {
    writeComment('Move it');
    answerConfirms(false);

    expect(await checkinFromPanel(panelCheckin({ included: [moved], allChanges: [moved, insideMoved] }))).toBe('notCheckedIn');

    expect(askedDialogs()).toEqual([{ kind: 'confirm', title: 'Also check in 1 change inside lib?' }]);
    expect(steps.checkins).toEqual([]);
  });

  it('checks the folder in with the changes inside it once confirmed', async () => {
    writeComment('Move it');
    answerConfirms(true);

    expect(await checkinFromPanel(panelCheckin({ included: [moved], allChanges: [moved, insideMoved] }))).toBe('checkedIn');

    expect(steps.checkins).toMatchObject([{ changes: [moved, insideMoved], paths: ['lib'], addsPrivate: false, quiet: true }]);
  });

  it('keeps the comment when no changeset was made', async () => {
    writeComment('Fix');
    steps.checkedIn = false;

    expect(await checkinFromPanel(panelCheckin())).toBe('notCheckedIn');

    expect(checkinDraftOf(ws).summary).toBe('Fix');
  });

  it('is busy only while checking in, not while asking', async () => {
    const busy: string[] = [];
    answerConfirms(true);

    await checkinFromPanel(panelCheckin(), async (run) => {
      busy.push(`asked ${askedDialogs().length}`);
      return run();
    });

    expect(busy).toEqual(['asked 1']);
  });
});

describe('shelveFromPanel', () => {
  it('shelves away with the draft comment, which goes along with the changes', async () => {
    writeComment('Half done');

    expect(await shelveFromPanel(panelShelve(), false)).toBe(true);

    expect(steps.shelves).toEqual([{ workspacePath: ws, changes: included, paths: ['src/a.ts', 'src/b.ts'], comment: 'Half done', keep: false }]);
    expect(checkinDraftOf(ws).summary).toBe('');
  });

  it('keeps the comment for the check-in when the changes stay here', async () => {
    writeComment('Half done');

    await shelveFromPanel(panelShelve(), true);

    expect(checkinDraftOf(ws).summary).toBe('Half done');
  });

  it('asks before a folder takes unchecked changes inside it into the shelve, and shelves nothing when declined', async () => {
    writeComment('Half done');
    answerConfirms(false);

    expect(await shelveFromPanel(panelShelve({ shelvable: [moved], allChanges: [moved, insideMoved] }), true)).toBe(false);

    expect(askedDialogs()).toEqual([{ kind: 'confirm', title: 'Also shelve 1 change inside lib?' }]);
    expect(steps.shelves).toEqual([]);
  });

  it('shelves nothing while unsaved edits keep it waiting', async () => {
    steps.settled = false;

    expect(await shelveFromPanel(panelShelve(), false)).toBe(false);

    expect(steps.shelves).toEqual([]);
  });
});
