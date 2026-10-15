import { BufferAttribute, BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { emphasisOf, LIT_OUTLINE_MAX_TRIANGLES, outlinesWhenLit } from './meshEmphasis';

describe('emphasisOf', () => {
  it('lights up a mesh picked, or under a node picked, and fades the rest while any is', () => {
    const picked = new Set(['Robot/Arm']);
    expect(['Robot/Arm', 'Robot/Arm/Hand', 'Robot/Armour', 'Robot/Leg'].map((key) => emphasisOf(key, picked, true))).toEqual(['lit', 'lit', 'faded', 'faded']);
  });

  it('draws every mesh plain while nothing is picked', () => {
    expect(emphasisOf('Robot/Arm', new Set(), false)).toBe('plain');
  });

  it('fades a side with nothing picked while the other side has a pick', () => {
    expect(emphasisOf('Robot/Arm', new Set(), true)).toBe('faded');
  });
});

describe('outlinesWhenLit', () => {
  const indexed = (triangles: number) => {
    const geometry = new BufferGeometry();
    geometry.setIndex(new BufferAttribute(new Uint32Array(triangles * 3), 1));
    return geometry;
  };

  it('outlines a lit mesh whose wires can be told apart, and not one whose wires would only tint it', () => {
    expect([outlinesWhenLit(indexed(LIT_OUTLINE_MAX_TRIANGLES)), outlinesWhenLit(indexed(LIT_OUTLINE_MAX_TRIANGLES + 1))]).toEqual([true, false]);
  });

  it('counts the triangles of a mesh without an index by its corners', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array((LIT_OUTLINE_MAX_TRIANGLES + 1) * 9), 3));
    expect(outlinesWhenLit(geometry)).toBe(false);
  });
});
