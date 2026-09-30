/**
 * A sidebar entry's count as its badge writes it: capped at 999+ on a wide row, and at 99+ on the rail's tile, where
 * the badge shares the icon's corner with the dot. The rail's tooltip gives the whole count (`navItemTip`).
 */
export function navBadgeText(count: number, rail: boolean): string {
  const cap = rail ? 99 : 999;
  return count > cap ? `${cap}+` : `${count}`;
}
