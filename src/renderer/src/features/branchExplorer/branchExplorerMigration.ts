import { EVERYONE } from '../../lib/peopleFilter';
import { sincePresetOf } from '../../lib/sincePresets';
import type { BranchExplorerPreferences } from './branchExplorerStore';

type Remembered = Partial<Omit<BranchExplorerPreferences, 'set'>>;

/**
 * The Branch Explorer's remembered preferences of an older version, as this one keeps them. Version 0 had date ranges
 * of its own, before every view shared the time presets; up to version 1 it kept whether its details were open
 * (`detailsOpen`), which `useDetailsPaneStore` keeps now for every view (`hiddenAfterMigration` carries it over).
 */
export function migrateBranchExplorerPreferences(persisted: unknown, version: number): Remembered {
  const { detailsOpen: _detailsOpen, ...remembered } = (persisted ?? {}) as Remembered & { detailsOpen?: boolean };
  if (version >= 1) return remembered;
  return { ...remembered, dateRange: sincePresetOf(remembered.dateRange) ?? 'lastMonth', people: EVERYONE };
}

/**
 * The views' hidden details once the Branch Explorer's remembered preferences are migrated: its own (`detailsKey`)
 * hidden when they were closed (`detailsOpen: false`), every other view's as it was.
 */
export function hiddenAfterMigration(persisted: unknown, hidden: Record<string, boolean>, detailsKey: string): Record<string, boolean> {
  const closed = (persisted as { detailsOpen?: unknown } | undefined)?.detailsOpen === false;
  return closed ? { ...hidden, [detailsKey]: true } : hidden;
}
