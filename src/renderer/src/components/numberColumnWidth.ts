/**
 * The widest a digit of `--font-mono` is at `--text-sm` across the OSes' mono fonts, rounded up: SF Mono and Menlo
 * on macOS, Cascadia and Consolas on Windows, DejaVu Sans Mono on Linux.
 */
const MONO_DIGIT_WIDTH = 8.2;

/** A table cell's padding on both sides (`DataTable`'s `.cell`: `--space-3` each). */
const CELL_PADDING = 24;

/**
 * A number column as wide as its longest number, for a list without column titles (whose title would otherwise set
 * its width): the comment starts right after the numbers, with no gap wider than between any two columns.
 */
export function numberColumnWidth(largest: number): number {
  return Math.ceil(CELL_PADDING + String(largest).length * MONO_DIGIT_WIDTH);
}
