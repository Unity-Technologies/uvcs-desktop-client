import '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const steps = vi.hoisted(() => ({ checkedIn: true, checkins: [] as unknown[], shelves: [] as unknown[] }));
vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));
vi.mock('../../app/navigation/leaveGuard', () => ({ settleBeforeLeaving: async () => true }));
vi.mock('./checkinOperations', () => ({
  checkinChanges: async (options: unknown) => {
    steps.checkins.push(options);
    return steps.checkedIn;
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
import { checkinSelectionOf, currentChoice, includedBy } from './checkinSelection';
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
const selection = (changes = allChanges) => checkinSelectionOf(changes, includedBy(currentChoice(checkinDraftOf(ws), changes)));

function prepare(changelist: Changelist, changelistsNow = changelists): void {
  const changes = changesByChangelist(allChanges).get(changelist.name) ?? [];
  prepareChangelistCheckin({ workspacePath: ws, changelist, changes, changelists: changelistsNow });
}

const panelCheckin = (included: PendingChange[]) => ({ workspacePath: ws, included, pendingCount: allChanges.length, behind: false, bulkPrivate: null, warnOnEmptyComment: true });

beforeEach(() => {
  Object.assign(steps, { checkedIn: true, checkins: [], shelves: [] });
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
  });

  it("takes for a shelve what a shelve can of the changelist's changes: not the link", () => {
    prepare(ui);

    expect(selection().shelvable).toEqual(uiChanges.filter((candidate) => candidate.itemType !== 'symlink'));
  });

  it('leaves out a change that appears after it, outside the changelist (an editor saving, a new .meta)', () => {
    prepare(ui);

    const saved = change('Assets/Hud.cs.meta', ['changed']);
    expect(selection([...allChanges, saved]).included).toEqual(uiChanges);
  });

  it('lets the user check or uncheck files by hand, inside the changelist or out of it', () => {
    prepare(ui);
    useCheckinDraftStore.getState().setIncluded(ws, ['src/menu.ts'], false);
    useCheckinDraftStore.getState().setIncluded(ws, ['README.md'], true);

    expect(selection().included.map((included) => included.path)).toEqual(['README.md', ...uiChanges.slice(1).map((included) => included.path)]);
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
    expect(selection().included).toEqual(uiChanges);

    prepare(plain);
    expect(checkinDraftOf(ws)).toMatchObject({ summary: '', description: '' });
  });

  // Only today's descriptions are compared: telling an old one from the user's own words would need to remember it.
  it('keeps a comment filled from a description that has since been edited, as if the user wrote it', () => {
    prepare(ui);
    const edited = [{ ...ui, description: 'Polish the menus again' }, art, plain];

    prepare(art, edited);

    expect(checkinDraftOf(ws)).toMatchObject({ summary: 'Polish the menus', description: 'Spacing and icons.' });
  });
});

describe('how a prepared changelist ends', () => {
  // Its files undone, shelved away by a switch, or checked in from outside the app: nothing would ever be checked again.
  it('ends once none of its files is pending, so a new change goes in', () => {
    prepare(ui);

    const edited = change('src/game/Enemy.cs', ['checkedOut', 'changed']);
    const afterUndo = [...defaultChanges, edited];
    expect(selection(afterUndo).included).toEqual([defaultChanges[0], defaultChanges[1], edited]);
  });

  // Undoing an added file leaves it on disk, private, at the same path: it is no longer the changelist's.
  it('ends once its files left the changelist, even when one stays on disk as a private file', () => {
    prepare(ui);

    const leftPrivate = change('src/icons.ts', ['private']);
    expect(selection([...defaultChanges, leftPrivate]).included).toEqual([defaultChanges[0], defaultChanges[1], leftPrivate]);
  });

  it('holds while some of its files are pending', () => {
    prepare(ui);

    expect(selection([...defaultChanges, uiChanges[0]!]).included).toEqual([uiChanges[0]]);
  });

  it('holds while the user unchecks every file: its files are still pending', () => {
    prepare(ui);

    useCheckinDraftStore.getState().setIncluded(ws, allChanges.map((candidate) => candidate.path), false);

    expect(selection().included).toEqual([]);
  });

  it('ends when the user checks every file, none hidden by the filters, back to the files they had left out', () => {
    useCheckinDraftStore.getState().setIncluded(ws, ['README.md'], false);
    prepare(ui);

    useCheckinDraftStore.getState().includeEverything(ws, allChanges.map((candidate) => candidate.path));

    expect(checkinDraftOf(ws).prepared).toBeNull();
    expect(selection().included).toEqual(allChanges.filter((candidate) => candidate.path !== 'build/out.log'));
  });
});

describe('checking in or shelving a changelist from the panel', () => {
  it("checks in the changelist's changes alone, in one check-in, with its description", async () => {
    prepare(ui);

    await checkinFromPanel(panelCheckin(selection().included));

    expect(steps.checkins).toEqual([{ workspacePath: ws, changes: uiChanges, comment: 'Polish the menus\n\nSpacing and icons.', updateFirst: false, quiet: false }]);
    expect(askedDialogs()).toEqual([]);
  });

  it('checks the files left out again once the changelist is checked in, but those the user had unchecked before', async () => {
    useCheckinDraftStore.getState().setIncluded(ws, ['README.md'], false);
    prepare(ui);

    await checkinFromPanel(panelCheckin(selection().included));

    expect(selection([...defaultChanges, artChange, plainChange]).included).toEqual([defaultChanges[1], artChange, plainChange]);
  });

  it('keeps the changelist alone checked when the check-in did not happen', async () => {
    steps.checkedIn = false;
    prepare(ui);

    await checkinFromPanel(panelCheckin(selection().included));

    expect(selection().included).toEqual(uiChanges);
  });

  it('still asks about an empty comment, for a changelist without a description', async () => {
    prepare(plain);

    expect(await checkinFromPanel(panelCheckin(selection().included))).toBe('checkedIn');

    expect(askedDialogs()).toEqual([{ kind: 'confirm', title: 'Check in without a comment?' }]);
    expect(steps.checkins).toEqual([expect.objectContaining({ changes: [plainChange], comment: '' })]);
  });

  it("shelves the changelist's changes alone, with its description, then checks the others again", async () => {
    prepare(ui);

    await shelveFromPanel(ws, selection().shelvable, true);

    expect(steps.shelves).toEqual([[ws, uiChanges.slice(0, 4), 'Polish the menus\n\nSpacing and icons.', true]]);
    expect(selection().included).toEqual(allChanges.filter((candidate) => candidate.path !== 'build/out.log'));
  });
});
