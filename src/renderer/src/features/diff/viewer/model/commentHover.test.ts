import { describe, expect, it } from 'vitest';
import { aimShownWhileCommenting, commentButtonLabel, hoverLabelOf, hoverLabelPlacement, hoveredPartOf, hoverPicks, litWhileCommenting, partNameOf, pickAgain, sameHoveredPart, type NamedVersion } from './commentHover';

/** A car as a glTF writes it: the scene's root, the car, its body, and a wheel GLTFLoader renamed apart (`Wheel_1`). */
const CAR: NamedVersion = {
  model: {
    nodes: [
      { name: 'Scene', parent: -1 },
      { name: 'Car', parent: 0 },
      { name: 'Body', parent: 1 },
      { name: 'Wheel', parent: 1 },
      { name: 'Wheel_1', fileName: 'Wheel', parent: 1 },
    ],
  },
  summary: { nodes: [{ key: '0' }, { key: '0/0' }, { key: '0/0/0' }, { key: '0/0/1' }, { key: '0/0/2' }] },
};

describe('hoveredPartOf', () => {
  it('names the part under the pointer as a comment on it would', () => {
    expect(hoveredPartOf({ side: 'after', key: '0/0/0' }, CAR, false)).toEqual({ side: 'after', key: '0/0/0', name: 'Body' });
  });

  it("names a part by the file's own name, not the one the loader gave it", () => {
    expect(hoveredPartOf({ side: 'after', key: '0/0/2' }, CAR, false)?.name).toBe('Wheel');
  });

  it('shows nothing over empty space', () => {
    expect(hoveredPartOf({ side: 'after', key: null }, CAR, false)).toBeNull();
    expect(hoveredPartOf(null, CAR, false)).toBeNull();
  });

  it('shows nothing for a mesh the file names no part for, or a key the version hasn’t', () => {
    expect(hoveredPartOf({ side: 'after', key: '0' }, CAR, false)).toBeNull();
    expect(hoveredPartOf({ side: 'after', key: '9/9' }, CAR, false)).toBeNull();
    expect(hoveredPartOf({ side: 'after', key: '0/0/0' }, null, false)).toBeNull();
  });

  it('lights nothing while Diffs by look compares, where a part lit would compare as a change', () => {
    expect(hoveredPartOf({ side: 'after', key: '0/0/0' }, CAR, true)).toBeNull();
  });
});

describe('partNameOf', () => {
  it('is the last of the part’s names from the root', () => {
    expect(partNameOf(CAR, '0/0')).toBe('Car');
    expect(partNameOf(CAR, '0/0/1')).toBe('Wheel');
  });
});

describe('sameHoveredPart', () => {
  const body = { side: 'after' as const, key: '0/0/0', name: 'Body' };

  it('is the same part on the same version', () => {
    expect(sameHoveredPart(body, { ...body })).toBe(true);
    expect(sameHoveredPart(null, null)).toBe(true);
  });

  it('differs by part, by version, or from none', () => {
    expect(sameHoveredPart(body, { ...body, key: '0/0/1' })).toBe(false);
    expect(sameHoveredPart(body, { ...body, side: 'before' })).toBe(false);
    expect(sameHoveredPart(body, null)).toBe(false);
  });
});

describe('litWhileCommenting', () => {
  const hovered = { side: 'after' as const, key: '0/0/1' };
  const comment = { side: 'after' as const, key: '0/0/0' };

  it('lights the part under the pointer only while Shift aims a click at all of it', () => {
    expect(litWhileCommenting(hovered, true, comment)).toBe(hovered);
  });

  it('lights nothing while a click would mark a point, not even a comment’s part: the light says what a click takes', () => {
    expect(litWhileCommenting(hovered, false, comment)).toBeNull();
  });

  it('lights the comment’s part with nothing under the pointer', () => {
    expect(litWhileCommenting(null, false, comment)).toBe(comment);
    expect(litWhileCommenting(null, true, null)).toBeNull();
  });
});

describe('hoverLabelOf', () => {
  const wheel = { side: 'after' as const, key: '0/0/1', name: 'Wheel' };

  it('names the point a click marks, and how to take the whole part', () => {
    expect(hoverLabelOf(wheel, false)).toEqual({ name: 'Point on Wheel', hint: 'Click to comment here, Shift for the whole part' });
  });

  it('names the whole part while Shift is held', () => {
    expect(hoverLabelOf(wheel, true)).toEqual({ name: 'Whole Wheel', hint: 'Click to comment on the whole part' });
  });
});

describe('commentButtonLabel', () => {
  it('says what a click and a Shift-click mark, in the hint’s words, or how to stop', () => {
    expect(commentButtonLabel(false)).toBe('Comment: click for a point, Shift-click for the whole part');
    expect(commentButtonLabel(true)).toBe('Stop commenting');
  });
});

describe('hoverLabelPlacement', () => {
  const label = { width: 120, height: 36 };
  const stage = { width: 800, height: 600 };

  it('sits below and right of the cursor', () => {
    expect(hoverLabelPlacement({ x: 100, y: 100 }, label, stage)).toEqual({ left: 118, top: 120 });
  });

  it('flips to the cursor’s left near the right edge, and above it near the bottom', () => {
    expect(hoverLabelPlacement({ x: 750, y: 580 }, label, stage)).toEqual({ left: 621, top: 534 });
  });

  it('stays inside a stage narrower than the room either side of the cursor', () => {
    const narrow = { width: 140, height: 600 };
    const { left } = hoverLabelPlacement({ x: 70, y: 100 }, label, narrow);
    expect(left).toBeGreaterThanOrEqual(6);
    expect(left + label.width).toBeLessThanOrEqual(narrow.width - 6);
  });
});

describe('hoverPicks', () => {
  it('picks under a pointer moving freely over the model', () => {
    expect(hoverPicks({ buttons: 0 }, false)).toBe(true);
  });

  it('picks nothing while a button is held (a drag turns the model) or over a pin, a card or a button', () => {
    expect(hoverPicks({ buttons: 1 }, false)).toBe(false);
    expect(hoverPicks({ buttons: 2 }, false)).toBe(false);
    expect(hoverPicks({ buttons: 0 }, true)).toBe(false);
  });
});

describe('pickAgain', () => {
  const last = { x: 100, y: 100, moves: 7 };

  it('picks the first time', () => {
    expect(pickAgain(null, last)).toBe(true);
  });

  it('picks once the pointer moved a pixel or more', () => {
    expect(pickAgain(last, { ...last, x: 101 })).toBe(true);
    expect(pickAgain(last, { ...last, y: 99 })).toBe(true);
  });

  it('picks once the model moved under the still pointer: a turn’s coast, a glide, a take', () => {
    expect(pickAgain(last, { ...last, moves: 8 })).toBe(true);
  });

  it('skips a frame where neither moved, as one a part lit up draws', () => {
    expect(pickAgain(last, { ...last })).toBe(false);
    expect(pickAgain(last, { ...last, x: 100.5, y: 100.4 })).toBe(false);
  });
});

describe('aimShownWhileCommenting', () => {
  const wheel = { side: 'after' as const, key: '0/0/1', name: 'Wheel' };

  it('lays the ring on the point a click would mark', () => {
    expect(aimShownWhileCommenting(wheel, false)).toBe(true);
  });

  it('takes it away with Shift held, over empty space, and while Diffs by look compares', () => {
    expect(aimShownWhileCommenting(wheel, true)).toBe(false);
    expect(aimShownWhileCommenting(null, false)).toBe(false);
    expect(aimShownWhileCommenting(hoveredPartOf({ side: 'after', key: '0/0/1' }, CAR, true), false)).toBe(false);
  });
});
