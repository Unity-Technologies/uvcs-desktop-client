/** The measured heights of a sidebar's groups: a group's title (0 when it shows none) and each of its items. */
export interface NavGroupHeights {
  labelHeight: number;
  itemHeights: readonly number[];
}

export interface NavLayout {
  groups: readonly NavGroupHeights[];
  /** Between two groups. */
  groupGap: number;
  /** Between the parts of a group: its title and its items, More among them. */
  itemGap: number;
  /** The More item's height. */
  moreHeight: number;
}

/**
 * How many of the sidebar's items show, in order across its groups, in `available` pixels: all of them when they fit;
 * otherwise as many as fit with the More item after the last one, which lists the rest (`NavGroups`), so a short
 * window, or a rail that shows no scrollbar, never hides entries out of sight. A group shows its title only when one of
 * its items shows.
 */
export function shownItemCount(layout: NavLayout, available: number): number {
  const total = layout.groups.reduce((count, group) => count + group.itemHeights.length, 0);
  if (heightOf(layout, total, false) <= available) return total;
  for (let shown = total - 1; shown > 0; shown--) if (heightOf(layout, shown, true) <= available) return shown;
  return 0;
}

/** The height of the first `shown` items with their groups' titles and gaps, and the More item after them. */
function heightOf(layout: NavLayout, shown: number, withMore: boolean): number {
  let height = 0;
  let groupsShown = 0;
  let left = shown;
  for (const group of layout.groups) {
    const items = group.itemHeights.slice(0, left);
    left -= items.length;
    const moreHere = withMore && left === 0 && (items.length > 0 || groupsShown === 0);
    if (items.length === 0 && !moreHere) break;
    const parts = [...(group.labelHeight > 0 && items.length > 0 ? [group.labelHeight] : []), ...items, ...(moreHere ? [layout.moreHeight] : [])];
    height += (groupsShown > 0 ? layout.groupGap : 0) + sum(parts) + layout.itemGap * (parts.length - 1);
    groupsShown++;
    if (left === 0) break;
  }
  return height;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
