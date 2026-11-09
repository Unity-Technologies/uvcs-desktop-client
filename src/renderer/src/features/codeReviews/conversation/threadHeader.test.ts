import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf, type ReviewThread } from './reviewThreads';
import { hasThreadHeader, threadHeaderOf, type ThreadHeaderInput } from './threadHeader';

const ON_LINE = { kind: 'line', revisionId: 29, itemId: 23, path: '/Assets/Scripts/SwitchFlow.cs', line: 11 } as const;

function comment(id: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'ana', date: '', text: '', kind: 'general', anchor: { kind: 'review' }, ...fields };
}

const threadOf = (...comments: ReviewComment[]): ReviewThread => threadsOf(comments)[0]!;
const reply = (id: number, fields: Partial<ReviewComment> = {}) => comment(id, { parentId: 1, kind: 'comment', author: 'bob@acme.com', ...fields });

const changeRequest = threadOf(comment(1, { kind: 'changeRequest', anchor: ON_LINE }));
const applied = threadOf(comment(1, { kind: 'changeRequest', anchor: ON_LINE, appliedInChangeset: 281 }));
const discarded = threadOf(comment(1, { kind: 'changeRequest', anchor: ON_LINE }), reply(2, { kind: 'discard' }));
const answered = threadOf(comment(1, { kind: 'question', anchor: ON_LINE }), reply(2), reply(3));
const plainOnLine = threadOf(comment(1, { kind: 'comment', anchor: ON_LINE }));
const general = threadOf(comment(1));

/** A header as the conversation shows it, unless the test says otherwise. */
const headerOf = (thread: ReviewThread, input: Partial<ThreadHeaderInput> = {}) =>
  threadHeaderOf({ thread, place: 'conversation', folded: false, foldable: false, hides: false, seesHowApplied: false, showsAnswer: true, ...input });

describe('hasThreadHeader', () => {
  it('gives a header to a thread on a line, a change request and a question, and none to a comment on the whole review', () => {
    expect(hasThreadHeader(plainOnLine)).toBe(true);
    expect(hasThreadHeader(threadOf(comment(1, { kind: 'changeRequest' })))).toBe(true);
    expect(hasThreadHeader(threadOf(comment(1, { kind: 'question' })))).toBe(true);
    expect(hasThreadHeader(general)).toBe(false);
  });
});

describe('threadHeaderOf', () => {
  describe('where the card is', () => {
    it('names the file in the conversation as a link to it in Changes, the line apart', () => {
      expect(headerOf(changeRequest).location).toEqual({ folder: 'Assets/Scripts/', file: 'SwitchFlow.cs', line: 'line 11', linked: true, tip: 'Show in Changes', tipSub: 'Assets/Scripts/SwitchFlow.cs' });
      expect(headerOf(changeRequest).kindLabel).toBeNull();
    });

    it('names the file in the Comments panel as text, its card going to the thread, whole in its tooltip', () => {
      expect(headerOf(changeRequest, { place: 'panel' }).location).toEqual({ folder: 'Assets/Scripts/', file: 'SwitchFlow.cs', line: 'line 11', linked: false, tip: 'Assets/Scripts/SwitchFlow.cs, line 11' });
    });

    it('names its kind in the code instead of the file it is at, with its icon even for a plain comment', () => {
      const header = headerOf(plainOnLine, { place: 'code' });
      expect([header.location, header.kindLabel, header.kindIcon]).toEqual([null, 'Comment', true]);
    });

    it('shows the icon of a change request or a question anywhere, and none on a plain comment outside the code', () => {
      expect(headerOf(changeRequest).kindIcon).toBe(true);
      expect(headerOf(plainOnLine).kindIcon).toBe(false);
      expect(headerOf(plainOnLine, { place: 'panel' }).kindIcon).toBe(false);
    });

    it('names no file for a comment on the whole review', () => {
      expect(headerOf(threadOf(comment(1, { kind: 'question' }))).location).toBeNull();
    });

    it('names the file a review deletes as any other: the comment is on its last revision', () => {
      const onDeleted = threadOf(comment(1, { kind: 'changeRequest', anchor: { ...ON_LINE, path: '/Old/Gone.cs', revisionId: 12 } }));
      expect(headerOf(onDeleted).location).toMatchObject({ folder: 'Old/', file: 'Gone.cs', linked: true });
    });
  });

  describe('the earlier-version tag and the × (the code only)', () => {
    const earlier = { label: 'Outdated', tip: 'Written on an earlier version', opensContext: true };

    it('shows the tag in the code, a way to the context when it opens one', () => {
      expect(headerOf(changeRequest, { place: 'code', earlier }).earlierTag).toEqual(earlier);
      expect(headerOf(changeRequest, { place: 'code', earlier: { ...earlier, opensContext: false } }).earlierTag?.opensContext).toBe(false);
    });

    it('shows neither outside the code', () => {
      const header = headerOf(changeRequest, { earlier, hides: true });
      expect([header.earlierTag, header.hides]).toEqual([null, false]);
    });

    it('offers the × while comments are hidden in the code', () => {
      expect(headerOf(changeRequest, { place: 'code', hides: true }).hides).toBe(true);
      expect(headerOf(changeRequest, { place: 'code' }).hides).toBe(false);
    });
  });

  describe('folding', () => {
    it('offers to show a folded settled thread, and to fold it shown, with how many replies it has while folded', () => {
      expect(headerOf(answered, { foldable: true, folded: true })).toMatchObject({ foldToggle: { expanded: false, label: 'Show the thread' }, replies: '2 replies' });
      expect(headerOf(answered, { foldable: true })).toMatchObject({ foldToggle: { expanded: true, label: 'Fold the thread' }, replies: null });
    });

    it('offers no fold toggle on a thread that stays whole, nor on the panel\'s cards, which stay folded', () => {
      expect(headerOf(changeRequest).foldToggle).toBeNull();
      expect(headerOf(answered, { place: 'panel', folded: true }).foldToggle).toBeNull();
    });

    it('counts no replies on a folded thread with none', () => {
      expect(headerOf(applied, { folded: true }).replies).toBeNull();
    });
  });

  describe('the pill', () => {
    it('says an open change request is open, as words', () => {
      expect(headerOf(changeRequest).pill).toEqual({ label: 'Open', tone: 'open', leadsTo: 'nothing' });
    });

    it('leads an applied one to how it was applied, or to its changeset', () => {
      expect(headerOf(applied, { seesHowApplied: true }).pill).toEqual({ label: 'Applied', tone: 'resolved', leadsTo: 'applied', changesetId: 281, tip: 'Applied in changeset 281: see how it was applied' });
      expect(headerOf(applied).pill).toMatchObject({ leadsTo: 'applied', tip: 'Applied in changeset 281: open it' });
    });

    it('says a discarded one was discarded, as words', () => {
      expect(headerOf(discarded).pill).toEqual({ label: 'Discarded', tone: 'discarded', leadsTo: 'nothing' });
    });

    it('leads an answered question to its first reply where the card shows replies, and is words in the panel', () => {
      expect(headerOf(answered).pill).toEqual({ label: 'Answered', tone: 'resolved', leadsTo: 'answer', tip: 'Answered by Bob: see the answer' });
      expect(headerOf(answered, { place: 'panel', showsAnswer: false }).pill).toEqual({ label: 'Answered', tone: 'resolved', leadsTo: 'nothing' });
    });

    it('shows none on a plain comment', () => {
      expect(headerOf(plainOnLine).pill).toBeNull();
    });
  });
});
