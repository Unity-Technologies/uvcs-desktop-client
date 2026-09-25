interface ChipsFitInput {
  /** Room in the cell for everything after the indentation. */
  available: number;
  /** The name and whatever sits before it (icon, gaps). */
  nameWidth: number;
  /** Each chip's width with its text, and the gap before it. */
  chipWidths: readonly number[];
  gap: number;
}

/** Whether the chips can show their text while the name shows whole; otherwise they shrink to their icons first. */
export function chipsFit({ available, nameWidth, chipWidths, gap }: ChipsFitInput): boolean {
  return nameWidth + chipWidths.reduce((total, width) => total + gap + width, 0) <= available;
}
