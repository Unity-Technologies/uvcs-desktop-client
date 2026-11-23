import { describe, expect, it } from 'vitest';
import { litCommentPart, takesModelComments, type ModelPin } from './modelAnnotations';

const pin = (key: string, fields: Partial<ModelPin> = {}): ModelPin => ({
  key,
  side: 'after',
  spot: { point: { x: 0, y: 0, z: 0 }, node: { path: ['Car', key] }, wholePart: true },
  author: 'ana',
  tip: '',
  emphasized: true,
  earlier: false,
  movable: false,
  ...fields,
});

describe('takesModelComments', () => {
  it('offers to comment where the place takes comments on a version shown', () => {
    expect(takesModelComments({ commentsOn: 'after' }, { before: true, after: true })).toBe(true);
    expect(takesModelComments({ commentsOn: 'after' }, { before: true, after: false })).toBe(false);
    expect(takesModelComments({ commentsOn: null }, { before: true, after: true })).toBe(false);
    expect(takesModelComments(null, { before: true, after: true })).toBe(false);
  });
});

describe('litCommentPart', () => {
  const wheel = pin('Wheel');
  const body = pin('Body');
  const onPoint = pin('Point', { spot: { point: { x: 0, y: 0, z: 0 }, node: { path: ['Car', 'Door'] } } });

  it("lights a part comment's part while its bubble is pointed at, its card open, or it's being written", () => {
    expect(litCommentPart([wheel, body], null, 'Wheel', false)).toBe(wheel);
    expect(litCommentPart([wheel, body], 'Body', null, false)).toBe(body);
    const writing = pin('New', { author: null });
    expect(litCommentPart([wheel, writing], null, null, false)).toBe(writing);
  });

  it('lights the one pointed at over the one open', () => {
    expect(litCommentPart([wheel, body], 'Body', 'Wheel', false)).toBe(wheel);
  });

  it('lights nothing for a comment on a point, nothing settled, nor while Diffs by look compares', () => {
    expect(litCommentPart([onPoint], 'Point', 'Point', false)).toBeNull();
    expect(litCommentPart([wheel], null, null, false)).toBeNull();
    expect(litCommentPart([wheel], 'Wheel', 'Wheel', true)).toBeNull();
  });
});
