import type { Place } from '@shared/domain/place';
import { offeredPrefixes, withoutScopePrefix, type PaletteScope } from './paletteScope';

/** A chip under the palette's search that narrows it to one section, showing the prefix that does the same typed. */
export interface ScopeChip {
  scope: PaletteScope;
  label: string;
  /** What the chip writes at the start of the search; none for All. */
  prefix: string;
}

/** The chips in the row, All first, and those under More. */
export interface ScopeChips {
  row: ScopeChip[];
  more: ScopeChip[];
}

const ALL_CHIP: ScopeChip = { scope: 'all', label: 'All', prefix: '' };

/** The sections searched most keep a chip in the row, in this order; the rest wait under More. */
const ROW_SCOPES: readonly PaletteScope[] = ['branches', 'changesets', 'files', 'commands'];

/**
 * The chips where the palette is open, one per prefix that works there (`offeredPrefixes`); none where there is only
 * one thing to search (the home screen's commands), as a lone chip would narrow nothing.
 */
export function scopeChipsFor(shown: Place | null): ScopeChips | null {
  const chips: ScopeChip[] = offeredPrefixes(shown).map(({ scope, label, prefix }) => ({ scope, label, prefix }));
  if (chips.length < 2) return null;
  const inRow = ROW_SCOPES.flatMap((scope) => chips.filter((chip) => chip.scope === scope));
  return { row: [ALL_CHIP, ...inRow], more: chips.filter((chip) => !ROW_SCOPES.includes(chip.scope)) };
}

/**
 * The search narrowed to a chip's section: its prefix in place of the one typed, the text kept. The search text is
 * the only state, so a chip and a typed prefix can't disagree, and clicking one shows what to type next time.
 */
export function queryInScope(query: string, chip: ScopeChip): string {
  return chip.prefix + withoutScopePrefix(query);
}

/** The chip `step` places away from the selected one, through the row then More, going round at either end. */
export function steppedChip({ row, more }: ScopeChips, scope: PaletteScope, step: 1 | -1): ScopeChip {
  const chips = [...row, ...more];
  const at = Math.max(0, chips.findIndex((chip) => chip.scope === scope));
  return chips[(at + step + chips.length) % chips.length]!;
}

/** The chip a click on one means: itself, or All when it was the one picked already, as a pressed toggle comes undone. */
export function clickedChip({ row }: ScopeChips, chip: ScopeChip, scope: PaletteScope): ScopeChip {
  return chip.scope === scope ? row[0]! : chip;
}

/** What the More chip says: the section picked under it, so the scope shows, else "More". */
export function moreChipLabel(more: readonly ScopeChip[], scope: PaletteScope): { label: string; active: boolean } {
  const picked = more.find((chip) => chip.scope === scope);
  return picked ? { label: picked.label, active: true } : { label: 'More', active: false };
}
