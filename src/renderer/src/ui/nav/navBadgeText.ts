/**
 * A sidebar entry's count as its badge writes it: capped at 999+ on a wide row, and at 99+ on the rail's tile, where
 * the badge is pinned on the icon and leaves the tile's corner to the dot. The rail's tooltip gives the whole count
 * (`navItemTip`).
 */
export function navBadgeText(count: number, rail: boolean): string {
  const cap = rail ? 99 : 999;
  return count > cap ? `${cap}+` : `${count}`;
}
