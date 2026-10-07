/** A sidebar entry's count. */
export interface NavBadge {
  count: number;
  /** There are more than `count`: whoever counted stopped short (the incoming check stops at 100). */
  more?: boolean;
}

/**
 * A sidebar entry's count as its badge writes it: capped at 999+ on a wide row, and at 99+ on the rail's tile, where
 * the badge is pinned on the icon and leaves the tile's corner to the dot; a count that stopped short reads "100+".
 * The rail's tooltip gives the whole count (`navItemTip`).
 */
export function navBadgeText({ count, more = false }: NavBadge, rail: boolean): string {
  const cap = rail ? 99 : 999;
  if (count > cap) return `${cap}+`;
  return more ? `${count}+` : `${count}`;
}
