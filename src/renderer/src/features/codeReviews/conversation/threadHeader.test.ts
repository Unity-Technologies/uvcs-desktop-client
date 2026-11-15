import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf, type ReviewThread } from './reviewThreads';
import { foldsByHand, hasThreadHeader, threadHeaderOf, type ThreadHeaderInput } from './threadHeader';

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
  threadHeaderOf({ thread, place: 'conversation', folded: false, foldable: false, hides: false, seesHowApplied: false, showsAnswer: true, inContext: false, ...input });

describe('hasThreadHeader', () => {
  it('gives a header to a thread on a line, a change request and a question, and none to a comment on the whole review', () => {
    expect(hasThreadHeader(plainOnLine)).toBe(true);
    expect(hasThreadHeader(threadOf(comment(1, { kind: 'changeRequest' })))).toBe(true);
    expect(hasThreadHeader(threadOf(comment(1, { kind: 'question' })))).toBe(true);
    expect(hasThreadHeader(general)).toBe(false);
  });
});

describe('foldsByHand', () => {
  it('folds every card with a header band, open or settled, so they all work the same way', () => {
    expect([changeRequest, applied, discarded, answered, plainOnLine].map(foldsByHand)).toEqual([true, true, true, true, true]);
    expect(foldsByHand(threadOf(comment(1, { kind: 'question' })))).toBe(true);
  });

  it("doesn't fold a comment on the whole review, which has no band to hold the chevron", () => {
    expect(foldsByHand(general)).toBe(false);
  });
});

describe('threadHeaderOf', () => {
  describe('where the card is', () => {
    it('names the file in the conversation as a link to it in Changes, the line apart', () => {
      expect(headerOf(changeRequest).location).toEqual({ folder: 'Assets/Scripts/', file: 'SwitchFlow.cs', line: 'line 11', linked: true, tip: 'Show in Changes', tipSub: 'Assets/Scripts/SwitchFlow.cs' });
    });

    it('names the file in the Comments panel as text, its card going to the thread, whole in its tooltip', () => {
      expect(headerOf(changeRequest, { place: 'panel' }).location).toEqual({ folder: 'Assets/Scripts/', file: 'SwitchFlow.cs', line: 'line 11', linked: false, tip: 'Assets/Scripts/SwitchFlow.cs, line 11' });
    });

    it('names no file under the file\'s name in the Comments panel', () => {
      expect(headerOf(plainOnLine, { place: 'fileGroup' }).location).toBeNull();
    });

    it('says the line apart where the file is named already, under its name or in its code, and nowhere else', () => {
      expect(headerOf(changeRequest, { place: 'fileGroup' }).line).toBe('line 11');
      // In the code, a thread can sit rows below its line, or away from it once outdated: the line says which.
      expect(headerOf(changeRequest, { place: 'code' }).line).toBe('line 11');
      expect(headerOf(changeRequest, { place: 'panel' }).line).toBeNull();
      expect(headerOf(changeRequest).line).toBeNull();
    });

    it('names no file in the code, where the thread is at its line', () => {
      expect(headerOf(plainOnLine, { place: 'code' }).location).toBeNull();
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
    const openQuestion = threadOf(comment(1, { kind: 'question', anchor: ON_LINE }));
    const PLACES = ['conversation', 'code', 'panel', 'fileGroup'] as const;

    it('tells an open change request from an open question by its kind, its words saying only that it is open, everywhere it shows', () => {
      for (const place of PLACES) {
        expect(headerOf(changeRequest, { place }).pill).toEqual({ kind: 'Change request', kindTip: 'Change request', label: 'Open', tone: 'open', leadsTo: 'nothing' });
        expect(headerOf(openQuestion, { place }).pill).toEqual({ kind: 'Question', kindTip: 'Question', label: 'Open', tone: 'open', leadsTo: 'nothing' });
      }
    });

    it('says a plain comment on a line is a comment, in a tone no state takes, as it stands nowhere, everywhere it shows', () => {
      for (const place of PLACES) expect(headerOf(plainOnLine, { place }).pill).toEqual({ kind: 'Comment', kindTip: null, label: 'Comment', tone: 'comment', leadsTo: 'nothing' });
    });

    it('names the kind in the icon\'s tooltip only where the words don\'t: never "Comment" twice', () => {
      expect([changeRequest, openQuestion, applied, plainOnLine].map((thread) => headerOf(thread).pill?.kindTip)).toEqual(['Change request', 'Question', 'Change request', null]);
    });

    it('leads a settled thread\'s pill with its kind', () => {
      expect([applied, discarded, answered].map((thread) => headerOf(thread, { folded: true }).pill?.kind)).toEqual(['Change request', 'Change request', 'Question']);
    });

    it('leads an applied one to how it was applied, or to its changeset', () => {
      expect(headerOf(applied, { seesHowApplied: true }).pill).toEqual({ kind: 'Change request', kindTip: 'Change request', label: 'Applied', tone: 'resolved', leadsTo: 'applied', changesetId: 281, tip: 'Applied in changeset 281: see how it was applied' });
      expect(headerOf(applied).pill).toMatchObject({ leadsTo: 'applied', tip: 'Applied in changeset 281: open it' });
    });

    it("names the changeset of an applied one shown in context and leads nowhere: the view is how it was applied, its changeset a button below", () => {
      expect(headerOf(applied, { place: 'code', inContext: true }).pill).toEqual({ kind: 'Change request', kindTip: 'Change request', label: 'Applied', tone: 'resolved', leadsTo: 'nothing', tip: 'Applied in changeset 281' });
    });

    it('leads a discarded one to it in context, where the card can show it, as an applied one does', () => {
      expect(headerOf(discarded, { seesHowApplied: true }).pill).toEqual({ kind: 'Change request', kindTip: 'Change request', label: 'Discarded', tone: 'discarded', leadsTo: 'context', tip: 'Discarded: see it in context' });
    });

    it('says a discarded one was discarded, as words, in context already or where nothing shows it', () => {
      expect(headerOf(discarded, { place: 'code', seesHowApplied: true, inContext: true }).pill).toEqual({ kind: 'Change request', kindTip: 'Change request', label: 'Discarded', tone: 'discarded', leadsTo: 'nothing' });
      expect(headerOf(discarded, { seesHowApplied: false }).pill).toEqual({ kind: 'Change request', kindTip: 'Change request', label: 'Discarded', tone: 'discarded', leadsTo: 'nothing' });
    });

    it('leads an answered question to its first reply where the card shows replies, and is words in the panel', () => {
      expect(headerOf(answered).pill).toEqual({ kind: 'Question', kindTip: 'Question', label: 'Answered', tone: 'resolved', leadsTo: 'answer', tip: 'Answered by Bob: see the answer' });
      expect(headerOf(answered, { place: 'panel', showsAnswer: false }).pill).toEqual({ kind: 'Question', kindTip: 'Question', label: 'Answered', tone: 'resolved', leadsTo: 'nothing' });
    });

    it('leads a question answered in a changeset to how it was answered, where the card can show it', () => {
      const fixed = threadOf(comment(1, { kind: 'question', anchor: ON_LINE }), reply(2, { text: 'Fixed in cs:281301' }));
      expect(headerOf(fixed, { seesHowApplied: true }).pill).toEqual({ kind: 'Question', kindTip: 'Question', label: 'Answered', tone: 'resolved', leadsTo: 'context', tip: 'Answered in changeset 281301: see how it was answered' });
      expect(headerOf(fixed, { place: 'code', seesHowApplied: true, inContext: true }).pill).toEqual({ kind: 'Question', kindTip: 'Question', label: 'Answered', tone: 'resolved', leadsTo: 'nothing', tip: 'Answered in changeset 281301' });
    });

    it('leads an answered question in context where the card shows no replies but can show it, as Discarded and Applied do', () => {
      expect(headerOf(answered, { place: 'panel', showsAnswer: false, seesHowApplied: true }).pill).toEqual({
        kind: 'Question',
        kindTip: 'Question',
        label: 'Answered',
        tone: 'resolved',
        leadsTo: 'context',
        tip: 'Answered: see it in context',
      });
    });

    it('shows none on a comment on the whole review, which has no header', () => {
      expect(headerOf(general).pill).toBeNull();
    });

    it('shows one on every thread with a header band, so the band always holds the kind', () => {
      for (const thread of [changeRequest, openQuestion, plainOnLine, applied, discarded, answered]) expect(hasThreadHeader(thread) && headerOf(thread).pill !== null).toBe(true);
    });

    it('names the kind of a change request or a question on the whole review', () => {
      expect(headerOf(threadOf(comment(1, { kind: 'question' }))).pill).toMatchObject({ kind: 'Question', kindTip: 'Question', label: 'Open' });
      expect(headerOf(threadOf(comment(1, { kind: 'changeRequest' }))).pill).toMatchObject({ kind: 'Change request', kindTip: 'Change request', label: 'Open' });
    });
  });
});
