import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { answerOf, appliedPillTip, commentLocationPage, locationText, repliesText, replyAction, startsFolded, threadBadges, threadKindName, writtenPlaceText, writtenPlaceTip } from './threadBadges';
import { threadsOf } from './reviewThreads';

const ON_LINE = { kind: 'line', revisionId: 29, itemId: 23, path: '/Assets/Scripts/SwitchFlow.cs', firstLine: 11, lastLine: 11 } as const;

function comment(id: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'ana', date: '', text: '', kind: 'general', anchor: { kind: 'review' }, ...fields };
}

const badgesOf = (...comments: ReviewComment[]) => threadBadges(threadsOf(comments)[0]!);

describe('threadBadges', () => {
  it('marks an open change request and question', () => {
    expect(badgesOf(comment(1, { kind: 'changeRequest', anchor: ON_LINE }))).toEqual({ kind: 'Change request', state: { label: 'Open', tone: 'open' } });
    expect(badgesOf(comment(1, { kind: 'question', anchor: ON_LINE }))).toEqual({ kind: 'Question', state: { label: 'Open', tone: 'open' } });
  });

  it('says how one was resolved: answered, applied in a changeset, discarded', () => {
    expect(badgesOf(comment(1, { kind: 'question' }), comment(2, { parentId: 1, kind: 'comment' })).state).toEqual({ label: 'Answered', tone: 'resolved' });
    expect(badgesOf(comment(1, { kind: 'changeRequest', appliedInChangeset: 4 }))).toEqual({ kind: 'Change request', state: { label: 'Applied', tone: 'resolved' }, appliedIn: 4 });
    expect(badgesOf(comment(1, { kind: 'changeRequest' }), comment(2, { parentId: 1, kind: 'discard' })).state).toEqual({ label: 'Discarded', tone: 'discarded' });
  });

  it('marks nothing on a plain or general comment', () => {
    expect(badgesOf(comment(1))).toEqual({});
    expect(badgesOf(comment(1, { kind: 'comment', anchor: ON_LINE }))).toEqual({});
  });
});

describe('appliedPillTip', () => {
  it('names the changeset that applied it, and what the pill does: how it was applied, else the changeset itself', () => {
    expect(appliedPillTip(4, true)).toBe('Applied in changeset 4: see how it was applied');
    expect(appliedPillTip(4, false)).toBe('Applied in changeset 4: open it');
  });
});

describe('answerOf', () => {
  it("is an answered question's first reply, which answered it, and its pill's tooltip names who wrote it", () => {
    const answered = threadsOf([comment(1, { kind: 'question' }), comment(2, { parentId: 1, kind: 'comment', author: 'borja.lopez' }), comment(3, { parentId: 1, kind: 'comment' })])[0]!;
    expect(answerOf(answered)).toEqual({ replyId: 2, tip: 'Answered by Borja Lopez: see the answer' });
  });

  it('is the reply written first, however cm listed them', () => {
    const second = '2026-11-09T12:04:22+01:00';
    const answered = threadsOf([comment(1, { kind: 'question' }), comment(5, { parentId: 1, kind: 'comment', date: second }), comment(4, { parentId: 1, kind: 'comment', date: second, author: 'bob' })])[0]!;
    expect(answerOf(answered)?.replyId).toBe(4);
  });

  it('is none for a thread no reply answers: an open question, a change request, a plain comment', () => {
    expect(answerOf(threadsOf([comment(1, { kind: 'question' })])[0]!)).toBeUndefined();
    expect(answerOf(threadsOf([comment(1, { kind: 'changeRequest' }), comment(2, { parentId: 1, kind: 'discard' })])[0]!)).toBeUndefined();
    expect(answerOf(threadsOf([comment(1, { kind: 'comment' }), comment(2, { parentId: 1, kind: 'comment' })])[0]!)).toBeUndefined();
  });
});

describe('replyAction and threadKindName', () => {
  it('says a discarding reply discarded it, and nothing of another', () => {
    expect(replyAction({ kind: 'discard' })).toBe('discarded it');
    expect(replyAction({ kind: 'comment' })).toBeUndefined();
  });

  it('names a thread a change request, a question or a comment', () => {
    expect(threadKindName({ kind: 'question' })).toBe('Question');
    expect(threadKindName({ kind: 'changeRequest' })).toBe('Change request');
    expect(threadKindName({ kind: 'comment' })).toBe('Comment');
  });
});

describe('a comment on a line', () => {
  it("reads as its file's path, as the diff names it; its line goes apart", () => {
    expect(locationText(ON_LINE)).toEqual({ folder: 'Assets/Scripts/', file: 'SwitchFlow.cs' });
    expect(writtenPlaceText(ON_LINE)).toBe('line 11');
  });

  it('reads a file at the top of the repository with no folder', () => {
    expect(locationText({ ...ON_LINE, path: '/README.md' })).toEqual({ folder: '', file: 'README.md' });
  });

  it('opens the review on its Changes tab at the thread, in its file', () => {
    expect(commentLocationPage(41, { id: 7, anchor: ON_LINE })).toEqual({ kind: 'codeReview', reviewId: 41, tab: 'changes', focusPath: 'Assets/Scripts/SwitchFlow.cs', focusThread: 7 });
  });

  it("opens one written in a changeset's diff on that changeset", () => {
    expect(commentLocationPage(41, { id: 7, anchor: ON_LINE, changesetId: 2 })).toEqual({
      kind: 'codeReview',
      reviewId: 41,
      tab: 'changes',
      focusPath: 'Assets/Scripts/SwitchFlow.cs',
      focusThread: 7,
      focusChangeset: 2,
    });
  });
});

describe('startsFolded', () => {
  const [plain, open, answered, applied, discarded] = threadsOf([
    comment(1),
    comment(2, { kind: 'changeRequest' }),
    comment(3, { kind: 'question' }),
    comment(4, { kind: 'comment', parentId: 3 }),
    comment(5, { kind: 'changeRequest', appliedInChangeset: 90 }),
    comment(6, { kind: 'changeRequest' }),
    comment(7, { kind: 'discard', parentId: 6 }),
  ]);

  it('folds a settled thread: applied, discarded, answered', () => {
    expect([answered, applied, discarded].map((thread) => startsFolded(thread!))).toEqual([true, true, true]);
  });

  it('shows an open thread and a plain comment whole', () => {
    expect([plain, open].map((thread) => startsFolded(thread!))).toEqual([false, false]);
  });
});

describe('repliesText', () => {
  it('counts the replies, saying nothing of none', () => {
    expect(repliesText({ replies: [] })).toBeUndefined();
    expect(repliesText({ replies: [comment(2)] })).toBe('1 reply');
    expect(repliesText({ replies: [comment(2), comment(3)] })).toBe('2 replies');
  });
});

describe('writtenPlaceText', () => {
  it('names the lines a comment was written on', () => {
    expect(writtenPlaceText({ ...ON_LINE, firstLine: 1962, lastLine: 1962 })).toBe('line 1962');
    expect(writtenPlaceText({ ...ON_LINE, firstLine: 12, lastLine: 18 })).toBe('lines 12–18');
  });

  it('names a comment on an image as on a point or an area of it', () => {
    const onImage = { kind: 'image', revisionId: 30, itemId: 24, path: '/Art/Hero.png' } as const;
    expect(writtenPlaceText({ ...onImage, spot: { x: 120, y: 80 } })).toBe('point');
    expect(writtenPlaceText({ ...onImage, spot: { x: 1, y: 2, size: { width: 30, height: 10 } } })).toBe('area');
  });
});

describe('a comment on a 3D model', () => {
  const onModel = { kind: 'model', revisionId: 30, itemId: 24, path: '/Art/Car.fbx' } as const;
  const point = { x: 1, y: 2, z: 3 };
  const onPointOf = (...path: string[]) => ({ ...onModel, spot: { point, node: { path } } });
  const onPartOf = (...path: string[]) => ({ ...onModel, spot: { point, node: { path }, wholePart: true as const } });

  it('names the part a point is on, and a whole part, as a line is named: its kind, then its name', () => {
    expect(writtenPlaceText(onPointOf('Wheel'))).toBe('point on Wheel');
    expect(writtenPlaceText(onPartOf('Wheel'))).toBe('part Wheel');
  });

  it('names a nested part by its own name, the last of its path', () => {
    expect(writtenPlaceText(onPointOf('Car', 'Door_L', 'Door_Panel'))).toBe('point on Door_Panel');
    expect(writtenPlaceText(onPartOf('Car', 'Door_L', 'Door_Panel'))).toBe('part Door_Panel');
  });

  it('names a part as the file names it, whatever characters it holds', () => {
    // The location stores names percent-encoded; the reader (`commentedModelSpotOf`) decodes them.
    expect(writtenPlaceText(onPointOf('Root/A', 'Wheel; FL=1'))).toBe('point on Wheel; FL=1');
    expect(writtenPlaceText(onPartOf('車', '車輪'))).toBe('part 車輪');
    expect(writtenPlaceText(onPointOf('Car', '🚗'))).toBe('point on 🚗');
  });

  it('says only "point" or "part" when the location names no part', () => {
    expect(writtenPlaceText({ ...onModel, spot: { point } })).toBe('point');
    expect(writtenPlaceText({ ...onModel, spot: { point, wholePart: true } })).toBe('part');
  });

  it('says only "point" or "part" when the part has a name an exporter gave it', () => {
    expect(writtenPlaceText(onPointOf('Car', 'mesh_0'))).toBe('point');
    expect(writtenPlaceText(onPartOf('Car', 'Object_12'))).toBe('part');
  });

  it("says in the tooltip which part, by its whole path, even when its own name says nothing", () => {
    expect(writtenPlaceTip(onPointOf('Car', 'Wheel'))).toBe('A point on Car › Wheel');
    expect(writtenPlaceTip(onPartOf('Car', 'Wheel_FL'))).toBe('The whole part Car › Wheel_FL');
    expect(writtenPlaceTip(onPartOf('Car', 'mesh_0'))).toBe('The whole part Car › mesh_0');
  });

  it('says in the tooltip only that it is on the model when no part is named', () => {
    expect(writtenPlaceTip({ ...onModel, spot: { point } })).toBe('A point on the model');
    expect(writtenPlaceTip({ ...onModel, spot: { point, wholePart: true } })).toBe('A part of the model');
  });

  it('leaves names the file left empty out of the path, and names no part when none is left', () => {
    expect(writtenPlaceTip(onPointOf('', 'Car', ' ', 'Wheel'))).toBe('A point on Car › Wheel');
    expect(writtenPlaceTip(onPointOf('', ' '))).toBe('A point on the model');
    expect(writtenPlaceTip(onPartOf(''))).toBe('A part of the model');
    expect(writtenPlaceText(onPointOf('Car', ''))).toBe('point');
    expect(writtenPlaceText(onPartOf('Car', ' '))).toBe('part');
  });
});

describe('writtenPlaceTip', () => {
  it('says the place is the line or the lines it was written on', () => {
    expect(writtenPlaceTip({ ...ON_LINE, firstLine: 42, lastLine: 42 })).toBe('The line it was written on');
    expect(writtenPlaceTip({ ...ON_LINE, firstLine: 12, lastLine: 18 })).toBe('The lines it was written on');
  });

  it('says the place is the point or the area of the image it was written on, never a line', () => {
    const onImage = { kind: 'image', revisionId: 30, itemId: 24, path: '/Art/Hero.png' } as const;
    expect(writtenPlaceTip({ ...onImage, spot: { x: 120, y: 80 } })).toBe('A point on the image at x 120, y 80');
    expect(writtenPlaceTip({ ...onImage, spot: { x: 1, y: 2, size: { width: 30, height: 10 } } })).toBe('A 30 × 10 pixel area of the image at x 1, y 2');
  });

  it('rounds the place of a point or an area of an SVG, whose numbers may have decimals', () => {
    const onSvg = { kind: 'image', revisionId: 30, itemId: 24, path: '/Art/Logo.svg' } as const;
    expect(writtenPlaceTip({ ...onSvg, spot: { x: 12.4, y: 7.6, size: { width: 30.5, height: 9.49 } } })).toBe('A 31 × 9 pixel area of the image at x 12, y 8');
  });
});

describe('commentLocationPage on an image', () => {
  it('opens the review on its Changes tab at the thread, in its image', () => {
    const anchor = { kind: 'image', revisionId: 30, itemId: 24, path: '/Art/Hero.png', spot: { x: 1, y: 2 } } as const;
    expect(commentLocationPage(41, { id: 9, anchor })).toEqual({ kind: 'codeReview', reviewId: 41, tab: 'changes', focusPath: 'Art/Hero.png', focusThread: 9 });
  });
});
