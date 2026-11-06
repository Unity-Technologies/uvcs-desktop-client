import { describe, expect, it } from 'vitest';
import { avatarStackLayout, SPREAD_GAP } from './avatarStackLayout';

describe('avatarStackLayout', () => {
  it('overlaps the avatars at rest, half of each one behind showing', () => {
    const { slots, restWidth } = avatarStackLayout(3, 18);
    expect(slots.map((slot) => slot.restX)).toEqual([0, 9, 18]);
    expect(restWidth).toBe(36);
  });

  it('spreads them side by side, apart enough for their rings', () => {
    const { slots, spreadWidth } = avatarStackLayout(3, 18);
    expect(slots.map((slot) => slot.spreadX)).toEqual([0, 18 + SPREAD_GAP, 2 * (18 + SPREAD_GAP)]);
    expect(spreadWidth).toBe(3 * 18 + 2 * SPREAD_GAP);
  });

  it('keeps the first avatar in front, each later one further back', () => {
    expect(avatarStackLayout(3, 18).slots.map((slot) => slot.layer)).toEqual([3, 2, 1]);
  });

  it('spreads from the first avatar and folds back from the last', () => {
    const { slots } = avatarStackLayout(3, 18);
    expect(slots.map((slot) => slot.order)).toEqual([0, 1, 2]);
    expect(slots.map((slot) => slot.reverseOrder)).toEqual([2, 1, 0]);
  });

  it('takes one avatar the same room at rest and spread, and none none', () => {
    expect(avatarStackLayout(1, 16)).toMatchObject({ restWidth: 16, spreadWidth: 16 });
    expect(avatarStackLayout(0, 16)).toEqual({ slots: [], restWidth: 0, spreadWidth: 0 });
  });

  it('rounds the peek to whole pixels, so odd sizes stay crisp', () => {
    expect(avatarStackLayout(2, 17).slots[1]!.restX).toBe(9);
  });
});
