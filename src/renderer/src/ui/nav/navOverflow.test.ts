import { describe, expect, it } from 'vitest';
import { shownItemCount, type NavLayout } from './navOverflow';

// Two groups of 28px rows under a 16px title, 1px apart inside a group and 20px between groups, as the expanded
// sidebar lays them out: 16 + 3 × 28 + 3 × 1 = 103px, then 20 + 16 + 2 × 28 + 2 × 1 = 94px, 197px in all.
const layout: NavLayout = {
  groups: [
    { labelHeight: 16, itemHeights: [28, 28, 28] },
    { labelHeight: 16, itemHeights: [28, 28] },
  ],
  groupGap: 20,
  itemGap: 1,
  moreHeight: 28,
};

describe('shownItemCount', () => {
  it('shows every item when they all fit, with no More', () => {
    expect(shownItemCount(layout, 197)).toBe(5);
    expect(shownItemCount(layout, 500)).toBe(5);
  });

  it('keeps room for More after the last item that shows', () => {
    // Four items and More in the second group: 103 + 20 + 16 + 28 + 1 + 1 + 28 = 197 would fit only without More.
    expect(shownItemCount(layout, 196)).toBe(3);
    // Three items and More at the end of the first group: 103 + 1 + 28 = 132.
    expect(shownItemCount(layout, 132)).toBe(3);
    expect(shownItemCount(layout, 131)).toBe(2);
  });

  it("shows a group's title only with one of its items", () => {
    // More goes in the first group (132px) rather than under the second group's title with none of its items (168px).
    expect(shownItemCount(layout, 150)).toBe(3);
  });

  it('counts no title for a group that shows none (the rail hides the first one)', () => {
    const rail = { ...layout, groups: [{ labelHeight: 0, itemHeights: [50, 50] }, { labelHeight: 1, itemHeights: [50] }], groupGap: 8, itemGap: 2 };
    // 50 + 2 + 50 + 2 + 28 = 132 with More after the second tile.
    expect(shownItemCount(rail, 132)).toBe(2);
    expect(shownItemCount(rail, 8 + 50 + 2 + 50 + 8 + 1 + 2 + 50)).toBe(3);
  });

  it('shows only More when not even one item fits beside it', () => {
    expect(shownItemCount(layout, 60)).toBe(0);
    expect(shownItemCount(layout, 10)).toBe(0);
  });

  it('shows nothing of an empty sidebar', () => {
    expect(shownItemCount({ ...layout, groups: [] }, 100)).toBe(0);
  });
});
