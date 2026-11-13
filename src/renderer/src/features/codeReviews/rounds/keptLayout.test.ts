import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import type { ReviewComment, ReviewEvent } from '@shared/domain/reviewConversation';
import { answerIsCurrent, keptLayoutAfter, type LayoutReading } from './keptLayout';
import { conversationLayoutOf } from './reviewRounds';

const REQUEST: ReviewComment = {
  id: 1,
  guid: 'g1',
  author: 'vio',
  date: '2026-11-09T15:00:00+01:00',
  text: 'Log the shelve number here.',
  kind: 'changeRequest',
  anchor: { kind: 'line', revisionId: 29, itemId: 23, path: '/Assets/Waves/WaveSpawner.cs', line: 43 },
  appliedInChangeset: 15,
};
const REWORK: ReviewEvent = { id: 2, author: 'vio', date: '2026-11-09T16:00:00+01:00', kind: 'statusChanged', status: 'Rework required', comment: '', guid: 's2' };
const APPLYING: Changeset = { id: 15, guid: 'c15', branch: '/main/waves', comment: 'Log it', owner: 'dani', date: '2026-11-10T09:00:00+01:00', parent: 14, repository: 'game@local' };

/** Review 43 read in full since the page opened: a request applied after the reviewer's last status. */
function reading(fields: Partial<LayoutReading> = {}): LayoutReading {
  return {
    reviewId: 43,
    reviewDate: '2026-11-07T08:00:00+01:00',
    user: 'vio',
    conversation: { comments: [REQUEST], events: [REWORK] },
    conversationRead: true,
    changesets: [APPLYING],
    changesetsRead: true,
    ...fields,
  };
}

const layoutOf = (read: LayoutReading) => conversationLayoutOf({ conversation: read.conversation!, user: read.user, changesets: read.changesets, reviewDate: read.reviewDate });

describe('keptLayoutAfter', () => {
  it('lays the conversation out once everything that places it is read', () => {
    expect(keptLayoutAfter(undefined, reading())).toEqual({ reviewId: 43, layout: layoutOf(reading()) });
  });

  it('waits for who the user is: their own statuses split the rounds', () => {
    expect(keptLayoutAfter(undefined, reading({ user: undefined }))).toBeUndefined();
  });

  it("waits for the branch's changesets: they say when a request was applied", () => {
    expect(keptLayoutAfter(undefined, reading({ changesets: undefined, changesetsRead: false }))).toBeUndefined();
  });

  it('waits for the reads the page started on opening, not what was kept from an earlier visit', () => {
    expect(keptLayoutAfter(undefined, reading({ conversationRead: false }))).toBeUndefined();
    expect(keptLayoutAfter(undefined, reading({ changesetsRead: false }))).toBeUndefined();
  });

  it('keeps the layout taken, whatever the conversation reads afterwards', () => {
    const kept = keptLayoutAfter(undefined, reading())!;
    const unmarked = reading({ conversation: { comments: [{ ...REQUEST, appliedInChangeset: undefined }], events: [REWORK] } });

    expect(keptLayoutAfter(kept, unmarked)).toBe(kept);
    expect(keptLayoutAfter(kept, reading({ conversationRead: false }))).toBe(kept);
  });

  it('lays out afresh for another review the page shows, once that one is read', () => {
    const kept = keptLayoutAfter(undefined, reading())!;

    expect(keptLayoutAfter(kept, reading({ reviewId: 44, changesetsRead: false }))).toBeUndefined();
    expect(keptLayoutAfter(kept, reading({ reviewId: 44 }))).toEqual({ reviewId: 44, layout: layoutOf(reading()) });
  });
});

describe('answerIsCurrent', () => {
  it('takes an answer read and not being read again', () => {
    expect(answerIsCurrent({ data: [], isError: false, isFetching: false, isPlaceholderData: false })).toBe(true);
  });

  it('takes a failed read: nothing more is coming', () => {
    expect(answerIsCurrent({ data: undefined, isError: true, isFetching: false, isPlaceholderData: false })).toBe(true);
  });

  it('refuses a cached answer the read on opening is about to replace', () => {
    expect(answerIsCurrent({ data: [], isError: false, isFetching: true, isPlaceholderData: false })).toBe(false);
  });

  it("refuses another review's changesets kept on screen while this one's are read", () => {
    expect(answerIsCurrent({ data: [], isError: false, isFetching: false, isPlaceholderData: true })).toBe(false);
  });

  it('refuses no answer yet', () => {
    expect(answerIsCurrent({ data: undefined, isError: false, isFetching: false, isPlaceholderData: false })).toBe(false);
  });
});
