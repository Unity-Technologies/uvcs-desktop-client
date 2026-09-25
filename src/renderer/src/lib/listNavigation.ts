/** Rows a PageUp / PageDown jump moves in a popover list: about one screenful. */
const PAGE_SIZE = 10;

/**
 * The index a navigation key moves a list highlight to, clamped to `[0, count)`;
 * null when the key doesn't navigate (so the caller lets it through, e.g. into a filter field).
 */
export function navigationTarget(key: string, current: number, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case 'ArrowDown':
      return Math.min(count - 1, current + 1);
    case 'ArrowUp':
      return Math.max(0, current - 1);
    case 'PageDown':
      return Math.min(count - 1, current + PAGE_SIZE);
    case 'PageUp':
      return Math.max(0, current - PAGE_SIZE);
    default:
      return null;
  }
}
