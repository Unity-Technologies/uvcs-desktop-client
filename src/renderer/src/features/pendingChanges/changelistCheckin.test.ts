import '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const steps = vi.hoisted(() => ({ checkins: [] as unknown[], shelves: [] as unknown[] }));
vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));
vi.mock('../../app/navigation/leaveGuard', () => ({ settleBeforeLeaving: async () => true }));
vi.mock('./checkinOperations', () => ({
  checkinChanges: async (options: unknown) => {
    steps.checkins.push(options);
    return true;
  },
  shelveChanges: async (...args: unknown[]) => {
    steps.shelves.push(args);
    return true;
  },
}));

import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { askedDialogs } from '../../testing/fakeDialogs';
import { changesByChangelist, prepareChangelistCheckin } from './changelistCheckin';
import { checkinDraftOf, useCheckinDraftStore } from './checkinDraftStore';
import { checkinSelectionOf, includedBy } from './checkinSelection';
import { checkinFromPanel, shelveFromPanel } from './submitCheckinPanel';

const ws = '/ws';
const change = (path: string, kinds: PendingChange['kinds'], changelist?: string, itemType: PendingChange['itemType'] = 'file'): PendingChange => ({
  path,
  kinds,
  itemType,
  size: 1,
  lastModified: '',
  ...(changelist && { changelist }),
});

const ui: Changelist = { name: 'ui', description: 'Polish the menus\n\nSpacing and icons.' };
const art: Changelist = { name: 'art', description: 'New textures' };
const plain: Changelist = { name: 'plain', description: '' };
const changelists = [ui, art, plain];

// The ui changelist holds every kind a changelist can: an edit, an added, a moved and a deleted file, and a link.
const uiChanges = [
  change('src/menu.ts', ['checkedOut', 'changed'], 'ui'),
  change('src/icons.ts', ['added'], 'ui'),
  change('src/new/place.ts', ['moved'], 'ui'),
  change('src/old.ts', ['deleted'], 'ui'),
  change('src/link', ['checkedOut'], 'ui', 'symlink'),
];
const artChange = change('art/wood.png', ['checkedOut', 'changed'], 'art');
const plainChange = change('docs/guide.md', ['checkedOut', 'changed'], 'plain');
const defaultChanges = [change('README.md', ['changed']), change('notes.txt', ['private']), change('build/out.log', ['ignored'])];
const allChanges = [...defaultChanges, ...uiChanges, artChange, plainChange];

/** What the panel checks in and shelves once the draft is as `prepareChangelistCheckin` left it. */
const selection = () => checkinSelectionOf(allChanges, includedBy(checkinDraftOf(ws).excludedPaths));

function prepare(changelist: Changelist, mode: 'checkin' | 'shelve' = 'checkin'): void {
  prepareChangelistCheckin({ workspacePath: ws, mode, changelist, allChanges, changelists });
}

beforeEach(() => {
  steps.checkins = [];
  steps.shelves = [];
  useCheckinDraftStore.setState({ drafts: {} });
});

describe('changesByChangelist', () => {
  it("lists each user changelist's changes by its name, and none of the default changelist's", () => {
    const byName = changesByChangelist(allChanges);

    expect(byName.get('ui')).toEqual(uiChanges);
    expect(byName.get('art')).toEqual([artChange]);
    expect([...byName.keys()].sort()).toEqual(['art', 'plain', 'ui']);
  });
});

describe('prepareChangelistCheckin', () => {
  it("checks exactly the changelist's changes, every other one left out, whatever was checked before", () => {
    useCheckinDraftStore.getState().setIncluded(ws, ['src/menu.ts'], false);

    prepare(ui);

    expect(selection().included).toEqual(uiChanges);
    expect(checkinDraftOf(ws).mode).toBe('checkin');
  });

  it("puts the panel in shelve mode, which takes what a shelve can of the changelist's changes: not the link", () => {
    prepare(ui, 'shelve');

    expect(checkinDraftOf(ws).mode).toBe('shelve');
    expect(selection().shelvable).toEqual(uiChanges.filter((candidate) => candidate.itemType !== 'symlink'));
  });

  it("takes the changelist's description as the comment, its first line as the summary", () => {
    prepare(ui);

    expect(checkinDraftOf(ws)).toMatchObject({ summary: 'Polish the menus', description: 'Spacing and icons.' });
  });

  it('keeps a comment the user wrote', () => {
    useCheckinDraftStore.getState().setMessage(ws, { summary: 'My own words', description: '' });

    prepare(ui);

    expect(checkinDraftOf(ws)).toMatchObject({ summary: 'My own words', description: '' });
  });

  it("replaces another changelist's description left untouched, and clears it for a changelist without one", () => {
    prepare(art);
    prepare(ui);
    expect(checkinDraftOf(ws)).toMatchObject({ summary: 'Polish the menus', description: 'Spacing and icons.' });

    prepare(plain);
    expect(checkinDraftOf(ws)).toMatchObject({ summary: '', description: '' });
  });
});

describe('checking in or shelving a changelist from the panel', () => {
  it("checks in the changelist's changes alone, in one check-in, with its description", async () => {
    prepare(ui);
    const { included } = selection();

    await checkinFromPanel({ workspacePath: ws, included, pendingCount: allChanges.length, behind: false, bulkPrivate: null, warnOnEmptyComment: true });

    expect(steps.checkins).toEqual([{ workspacePath: ws, changes: uiChanges, comment: 'Polish the menus\n\nSpacing and icons.', updateFirst: false, quiet: false }]);
    expect(askedDialogs()).toEqual([]);
  });

  it('still asks about an empty comment, for a changelist without a description', async () => {
    prepare(plain);
    const { included } = selection();

    expect(await checkinFromPanel({ workspacePath: ws, included, pendingCount: allChanges.length, behind: false, bulkPrivate: null, warnOnEmptyComment: true })).toBe('checkedIn');

    expect(askedDialogs()).toEqual([{ kind: 'confirm', title: 'Check in without a comment?' }]);
    expect(steps.checkins).toEqual([expect.objectContaining({ changes: [plainChange], comment: '' })]);
  });

  it("shelves the changelist's changes alone, with its description", async () => {
    prepare(ui, 'shelve');

    await shelveFromPanel(ws, selection().shelvable, false);

    expect(steps.shelves).toEqual([[ws, uiChanges.slice(0, 4), 'Polish the menus\n\nSpacing and icons.', false]]);
  });
});
