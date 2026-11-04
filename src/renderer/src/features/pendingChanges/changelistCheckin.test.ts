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
  shelveChanges: async (options: unknown) => {
    steps.shelves.push(options);
    return true;
  },
}));

import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { askedDialogs } from '../../testing/fakeDialogs';
import { changesByChangelist, prepareChangelistCheckin, preparedChangelistNote } from './changelistCheckin';
import { indexPending } from './checkinDependencies';
import { checkinDraftOf, useCheckinDraftStore } from './checkinDraftStore';
import { checkinFactsOf, type CheckinSelection, checkinSelectionOf, currentChoice } from './checkinSelection';
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

/** What the panel checks in and shelves once the draft is as `prepareChangelistCheckin` left it, of the changes the filter shows. */
const selection = (changes = allChanges, matchingFilter = changes) =>
  checkinSelectionOf({ all: changes, matchingFilter, index: indexPending(changes), facts: checkinFactsOf(changes) }, currentChoice(checkinDraftOf(ws), changes));

const filterCleared = vi.fn();

/** Readies `changelist`, null for the default one, as its menu's "Check in this changelist" does. */
function prepare(changelist: Changelist | null, changelistsNow = changelists): void {
  const changes = changesByChangelist(allChanges).get(changelist?.name ?? null) ?? [];
  prepareChangelistCheckin({ workspacePath: ws, changelist, changes, index: indexPending(allChanges), changelists: changelistsNow, clearFilter: filterCleared });
}

const panelCheckin = ({ included, hiddenIncludedCount }: CheckinSelection) => ({
  workspacePath: ws,
  included,
  hiddenIncludedCount,
  allChanges,
  behind: false,
  bulkPrivate: null,
  warnOnEmptyComment: true,
});
const panelShelve = ({ shelvable, hiddenIncludedCount }: CheckinSelection) => ({ workspacePath: ws, shelvable, hiddenIncludedCount, allChanges });

beforeEach(() => {
  Object.assign(steps, { checkedIn: true, checkins: [], shelves: [] });
  filterCleared.mockClear();
  useCheckinDraftStore.setState({ drafts: {} });
});

describe('changesByChangelist', () => {
  it("lists each user changelist's changes by its name, and the default changelist's under null", () => {
    const byName = changesByChangelist(allChanges);

    expect(byName.get('ui')).toEqual(uiChanges);
    expect(byName.get('art')).toEqual([artChange]);
    expect(byName.get(null)).toEqual(defaultChanges);
    expect(byName.size).toBe(4);
  });
});

describe('prepareChangelistCheckin', () => {
  it("checks exactly the changelist's changes, every other one left out, whatever was checked before", () => {
    useCheckinDraftStore.getState().setIncluded(ws, ['src/menu.ts'], false);

    prepare(ui);

    expect(selection().included).toEqual(uiChanges);
  });

  // A check-in takes only the changes the filter shows: cleared, every file of the changelist shows and goes in.
  it('clears the filter, so every file of the changelist shows', () => {
    prepare(ui);

    expect(filterCleared).toHaveBeenCalledOnce();
  });

  // A private file in the changelist can't go in without its private folder, which is in no changelist.
  it('checks what its changes need with them, outside the changelist', () => {
    const generated = { ...change('gen', ['private']), itemType: 'directory' as const };
    const generatedFile = change('gen/Api.cs', ['private'], 'api');
    const api: Changelist = { name: 'api', description: '' };
    prepareChangelistCheckin({ workspacePath: ws, changelist: api, changes: [generatedFile], index: indexPending([generated, generatedFile]), changelists: [api], clearFilter: filterCleared });

    expect([...checkinDraftOf(ws).prepared!.paths].sort()).toEqual(['gen', 'gen/Api.cs']);
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
  // A filter typed after preparing it showed two of its five files: the other three are still to go in, checked alone.
  it('holds after a check-in of only the files the filter showed', async () => {
    prepare(ui);

    await checkinFromPanel(panelCheckin(selection(allChanges, uiChanges.slice(0, 2))));

    expect(steps.checkins).toEqual([expect.objectContaining({ changes: uiChanges.slice(0, 2) })]);
    expect(checkinDraftOf(ws).prepared?.name).toBe('ui');
  });

  it('holds after a shelve of only the files the filter showed', async () => {
    prepare(ui);

    await shelveFromPanel(panelShelve(selection(allChanges, uiChanges.slice(0, 2))), true);

    expect(checkinDraftOf(ws).prepared?.name).toBe('ui');
  });

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

    await checkinFromPanel(panelCheckin(selection()));

    expect(steps.checkins).toEqual([
      {
        workspacePath: ws,
        changes: uiChanges,
        paths: uiChanges.map((candidate) => candidate.path),
        addsPrivate: false,
        comment: 'Polish the menus\n\nSpacing and icons.',
        updateFirst: false,
        quiet: false,
      },
    ]);
    expect(askedDialogs()).toEqual([]);
  });

  it('checks the files left out again once the changelist is checked in, but those the user had unchecked before', async () => {
    useCheckinDraftStore.getState().setIncluded(ws, ['README.md'], false);
    prepare(ui);

    await checkinFromPanel(panelCheckin(selection()));

    expect(selection([...defaultChanges, artChange, plainChange]).included).toEqual([defaultChanges[1], artChange, plainChange]);
  });

  it('keeps the changelist alone checked when the check-in did not happen', async () => {
    steps.checkedIn = false;
    prepare(ui);

    await checkinFromPanel(panelCheckin(selection()));

    expect(selection().included).toEqual(uiChanges);
  });

  it('still asks about an empty comment, for a changelist without a description', async () => {
    prepare(plain);

    expect(await checkinFromPanel(panelCheckin(selection()))).toBe('checkedIn');

    expect(askedDialogs()).toEqual([{ kind: 'confirm', title: 'Check in without a comment?' }]);
    expect(steps.checkins).toEqual([expect.objectContaining({ changes: [plainChange], comment: '' })]);
  });

  it("shelves the changelist's changes alone, with its description, then checks the others again", async () => {
    prepare(ui);

    await shelveFromPanel(panelShelve(selection()), true);

    expect(steps.shelves).toEqual([
      { workspacePath: ws, changes: uiChanges.slice(0, 4), paths: uiChanges.slice(0, 4).map((candidate) => candidate.path), comment: 'Polish the menus\n\nSpacing and icons.', keep: true },
    ]);
    expect(selection().included).toEqual(allChanges.filter((candidate) => candidate.path !== 'build/out.log'));
  });
});

describe('checking in or shelving the default changelist', () => {
  it('checks exactly its changes, those of every user changelist left out', () => {
    prepare(null);

    expect(checkinDraftOf(ws).prepared?.name).toBeNull();
    expect(selection().included).toEqual(defaultChanges.slice(0, 2));
  });

  it('is named under the panel\'s button as the list names it', () => {
    prepare(null);
    expect(preparedChangelistNote(checkinDraftOf(ws).prepared)).toBe('Default changelist');

    prepare(ui);
    expect(preparedChangelistNote(checkinDraftOf(ws).prepared)).toBe('Changelist ui');
    expect(preparedChangelistNote(null)).toBeNull();
  });

  it('has no description: it clears one a user changelist left, and keeps the comment the user wrote', () => {
    prepare(ui);
    prepare(null);
    expect(checkinDraftOf(ws)).toMatchObject({ summary: '', description: '' });

    useCheckinDraftStore.getState().setMessage(ws, { summary: 'My own words', description: '' });
    prepare(null);
    expect(checkinDraftOf(ws)).toMatchObject({ summary: 'My own words' });
  });

  it('checks in its changes alone, then checks the others again', async () => {
    useCheckinDraftStore.getState().setMessage(ws, { summary: 'Readme', description: '' });
    prepare(null);

    await checkinFromPanel(panelCheckin(selection()));

    expect(steps.checkins).toEqual([expect.objectContaining({ changes: defaultChanges.slice(0, 2), comment: 'Readme' })]);
    expect(checkinDraftOf(ws).prepared).toBeNull();
  });

  it('shelves what a shelve can take of its changes: not the private file', async () => {
    prepare(null);

    await shelveFromPanel(panelShelve(selection()), true);

    expect(steps.shelves).toEqual([expect.objectContaining({ changes: [defaultChanges[0]] })]);
  });

  // Every new edit lands in the default changelist: were it read by membership, as a user changelist is, it would never end.
  it('holds while one of its readied changes is pending, a change made meanwhile left unchecked', () => {
    prepare(null);

    const edited = change('src/game/Enemy.cs', ['changed']);
    expect(selection([defaultChanges[0]!, edited, ...uiChanges]).included).toEqual([defaultChanges[0]]);
  });

  it('ends once none of its readied changes is pending, though new ones are in it: they are checked again', () => {
    prepare(null);

    const edited = change('src/game/Enemy.cs', ['changed']);
    expect(selection([edited, ...uiChanges]).included).toEqual([edited, ...uiChanges]);
  });

  // An ignored, cloaked or hidden change can't go in, and stays pending: readied, it would keep the changelist going.
  it('ends though a change it can never check in is still pending in it', () => {
    prepare(null);

    const edited = change('src/game/Enemy.cs', ['changed']);
    const ignored = defaultChanges[2]!;
    expect(selection([ignored, edited, ...uiChanges]).included).toEqual([edited, ...uiChanges]);
  });

  // The user means to check in a private file left checked: it keeps the changelist going until it is added or deleted.
  it('holds while a private file it readied is pending', () => {
    prepare(null);

    const edited = change('src/game/Enemy.cs', ['changed']);
    expect(selection([defaultChanges[1]!, edited, ...uiChanges]).included).toEqual([defaultChanges[1]]);
  });

  // A `Builds/` folder unchecked on purpose stays out: readying the default changelist isn't asking for it.
  it('leaves out the files the user had unchecked', () => {
    useCheckinDraftStore.getState().setIncluded(ws, ['notes.txt'], false);

    prepare(null);

    expect(selection().included).toEqual([defaultChanges[0]]);
  });

  it('holds while the user unchecks every file: its readied changes are still pending', () => {
    prepare(null);

    useCheckinDraftStore.getState().setIncluded(ws, allChanges.map((candidate) => candidate.path), false);

    expect(selection().included).toEqual([]);
  });

  it('ends once its readied changes moved to a user changelist', () => {
    prepare(null);

    const moved = { ...defaultChanges[0]!, kinds: ['checkedOut' as const, 'changed' as const], changelist: 'ui' };
    expect(selection([moved, ...uiChanges]).included).toEqual([moved, ...uiChanges]);
  });
});
