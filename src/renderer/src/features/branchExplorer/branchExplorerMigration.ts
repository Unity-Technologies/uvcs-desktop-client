import { EVERYONE } from '../../lib/peopleFilter';
import { sincePresetOf } from '../../lib/sincePresets';
import type { BranchExplorerPreferences } from './branchExplorerStore';

type Remembered = Partial<Omit<BranchExplorerPreferences, 'set'>>;

/**
 * The Branch Explorer's remembered preferences of an older version, as this one keeps them. Version 0 had date ranges
 * of its own, before every view shared the time presets; up to version 1 it kept whether its details were open
 * (`detailsOpen`), which `useDetailsPaneStore` keeps now for every view (`detailsOpenOf` reads it to carry it over).
 */
export function migrateBranchExplorerPreferences(persisted: unknown, version: number): Remembered {
  const { detailsOpen: _detailsOpen, ...remembered } = (persisted ?? {}) as Remembered & { detailsOpen?: boolean };
  if (version >= 1) return remembered;
  return { ...remembered, dateRange: sincePresetOf(remembered.dateRange) ?? 'lastMonth', people: EVERYONE };
}

/** Whether the details were open in preferences remembered before every view could hide its own: open unless closed. */
export function detailsOpenOf(persisted: unknown): boolean {
  return (persisted as { detailsOpen?: unknown } | undefined)?.detailsOpen !== false;
}
