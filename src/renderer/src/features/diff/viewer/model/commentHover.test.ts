import { describe, expect, it } from 'vitest';
import { commentButtonLabel, hoverLabelOf, hoverLabelPlacement, hoveredPartOf, litWhileCommenting, partNameOf, sameHoveredPart, type NamedVersion } from './commentHover';

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

  it('lights the part under the pointer over a comment’s part', () => {
    expect(litWhileCommenting(hovered, comment)).toBe(hovered);
  });

  it('lights the comment’s part with nothing under the pointer', () => {
    expect(litWhileCommenting(null, comment)).toBe(comment);
    expect(litWhileCommenting(null, null)).toBeNull();
  });
});

describe('hoverLabelOf', () => {
  it('names the part, and the click for all of it', () => {
    expect(hoverLabelOf({ side: 'after', key: '0/0/1', name: 'Wheel' })).toEqual({ name: 'Wheel', hint: 'Shift-click for the whole part' });
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
