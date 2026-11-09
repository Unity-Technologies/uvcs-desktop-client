import '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const steps = vi.hoisted(() => ({
  comments: [] as (string | undefined)[],
  askedCounts: [] as number[],
  settled: true,
  checkedIn: true,
  checkins: [] as unknown[],
}));
vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));
vi.mock('../../app/navigation/leaveGuard', () => ({ settleBeforeLeaving: async () => steps.settled }));
vi.mock('./CheckinCommentDialog', () => ({
  askForCheckinComment: async (count: number) => {
    steps.askedCounts.push(count);
    return steps.comments.shift();
  },
}));
vi.mock('../pendingChanges/checkinOperations', () => ({
  checkinChanges: async (options: unknown) => {
    steps.checkins.push(options);
    return steps.checkedIn;
  },
}));

import type { PendingChange } from '@shared/domain/pendingChanges';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { answerConfirms, askedDialogs } from '../../testing/fakeDialogs';
import { checkinItems } from './filesCheckinOperation';

const ws = '/ws';
const change = (path: string, kinds: PendingChange['kinds'], itemType: PendingChange['itemType'] = 'file'): PendingChange => ({
  path,
  kinds,
  itemType,
  size: 1,
  lastModified: '',
});
const newFile = change('notes.txt', ['private']);
const edited = change('src/app.ts', ['changed']);

beforeEach(() => {
  Object.assign(steps, { comments: [], askedCounts: [], settled: true, checkedIn: true, checkins: [] });
  queryClient.setQueryData(queryKeys.settings, DEFAULT_SETTINGS);
});

describe('checkinItems', () => {
  it('checks in just the new file, adding it, with the comment written', async () => {
    steps.comments.push('Add notes');

    expect(await checkinItems(ws, [newFile], [newFile, edited])).toBe(true);

    expect(steps.askedCounts).toEqual([1]);
    expect(steps.checkins).toEqual([
      { workspacePath: ws, changes: [newFile], paths: ['notes.txt'], addsPrivate: true, comment: 'Add notes', quiet: false },
    ]);
  });

  it('lets the success card tell it when nothing is left pending', async () => {
    steps.comments.push('Edit');

    await checkinItems(ws, [edited], [edited]);

    expect(steps.checkins).toEqual([expect.objectContaining({ quiet: true })]);
  });

  it('tells by a toast a check-in of a private file Changes never listed, when another change stays pending', async () => {
    const unlisted = change('build/notes.txt', ['private']);
    steps.comments.push('Add notes');

    await checkinItems(ws, [unlisted], [edited]);

    expect(steps.checkins).toEqual([expect.objectContaining({ quiet: false })]);
  });

  it('checks in nothing when the comment is cancelled', async () => {
    expect(await checkinItems(ws, [newFile], [newFile])).toBe(false);
    expect(steps.checkins).toEqual([]);
  });

  it('asks for a comment again when an empty one is declined', async () => {
    steps.comments.push('', 'Add notes');
    answerConfirms(false);

    await checkinItems(ws, [newFile], [newFile]);

    expect(askedDialogs().map((dialog) => dialog.title)).toEqual(['Check in without a comment?']);
    expect(steps.checkins).toEqual([expect.objectContaining({ comment: 'Add notes' })]);
  });

  it('checks in without a comment once the user agrees', async () => {
    steps.comments.push('  ');

    await checkinItems(ws, [newFile], [newFile]);

    expect(steps.checkins).toEqual([expect.objectContaining({ comment: '  ' })]);
  });

  it("doesn't ask about an empty comment when the setting says not to", async () => {
    queryClient.setQueryData(queryKeys.settings, { ...DEFAULT_SETTINGS, warnOnEmptyComment: false });
    steps.comments.push('');

    await checkinItems(ws, [newFile], [newFile]);

    expect(askedDialogs()).toEqual([]);
    expect(steps.checkins).toHaveLength(1);
  });

  it('checks in nothing when unsaved edits keep it from going', async () => {
    steps.comments.push('Edit');
    steps.settled = false;

    expect(await checkinItems(ws, [edited], [edited])).toBe(false);
    expect(steps.checkins).toEqual([]);
  });

  it('asks before adding a pile of private files, and stops when declined', async () => {
    const pile = Array.from({ length: 2000 }, (_, index) => change(`gen/f${index}.bin`, ['private']));
    steps.comments.push('Add generated');
    answerConfirms(false);

    expect(await checkinItems(ws, pile, pile)).toBe(false);
    expect(askedDialogs().map((dialog) => dialog.title)).toEqual(['Check in 2,000 private files?']);
    expect(steps.checkins).toEqual([]);
  });

  it('asks before a moved folder takes along a change not selected, and checks it in too', async () => {
    const moved = change('lib', ['moved'], 'directory');
    const inside = change('lib/b.cs', ['changed']);
    steps.comments.push('Move lib');

    await checkinItems(ws, [moved], [moved, inside]);

    expect(askedDialogs().map((dialog) => dialog.title)).toEqual(['Also check in 1 change inside lib?']);
    expect(steps.checkins).toEqual([expect.objectContaining({ changes: [moved, inside] })]);
  });
});
