import { regionContaining, type ChangedLine, type ChangeRegion } from './changeBlocks';
import type { DiffLayout } from './diffPreferencesStore';

/**
 * The change the chip is for: the one holding the picked lines, else the one hovered (or held while the pointer makes
 * its way to the chip), while the diff still has it.
 */
export function chipRegion(regions: ChangeRegion[], picked: ChangedLine[] | null, held: ChangeRegion | undefined): ChangeRegion | undefined {
  if (picked) return regionContaining(regions, picked[0]!);
  return held && regions.includes(held) ? held : undefined;
}

/** The lines the chip sits by: side by side, the change's new code (its added lines) unless it only removes lines. */
export function chipAnchorLines({ lines }: ChangeRegion, layout: DiffLayout): ChangedLine[] {
  const added = lines.filter((line) => line.side === 'additions');
  return layout === 'split' && added.length > 0 ? added : lines;
}

/** Where the chip's top goes: on the change's top edge, or on its bottom edge when that would be above the diff. */
export function chipTop(changeTop: number, changeBottom: number, chipHeight: number): number {
  const above = changeTop - chipHeight;
  return above >= 0 ? above : changeBottom;
}
