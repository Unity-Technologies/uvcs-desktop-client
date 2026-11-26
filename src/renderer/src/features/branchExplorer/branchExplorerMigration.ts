import type { BranchExplorerKept } from '../../app/settings/windowKeptSettings';
import { EVERYONE } from '../../lib/peopleFilter';
import { sincePresetOf } from '../../lib/sincePresets';
import type { BranchExplorerActions, BranchExplorerPreferences } from './branchExplorerStore';

type Remembered = Partial<Omit<BranchExplorerPreferences, BranchExplorerActions>>;

/** The preferences an older version remembered, as this one remembers them, and what the app's settings keep now. */
export interface MigratedPreferences {
  remembered: Remembered;
  /** What it kept per repository and for everyone, for the app's settings (`bringStoredWindowSettings`); null if nothing. */
  kept: BranchExplorerKept | null;
}

/**
 * The Branch Explorer's remembered preferences of an older version, as this one keeps them. Version 0 had date ranges
 * of its own, before every view shared the time presets; up to version 1 it kept whether its details were open
 * (`detailsOpen`), which `useDetailsPaneStore` keeps now for every view (`hiddenAfterMigration` carries it over); up to
 * version 2 it kept the rules, moved branches and changeset colors, which the app's settings keep now.
 */
export function migrateBranchExplorerPreferences(persisted: unknown, version: number): MigratedPreferences {
  const {
    detailsOpen: _detailsOpen,
    rulesByRepository,
    rulesOff,
    userColors,
    userColorsOff,
    pinsByRepository,
    ...remembered
  } = (persisted ?? {}) as Remembered & BranchExplorerKept & { detailsOpen?: boolean };
  const kept: BranchExplorerKept = { rulesByRepository, rulesOff, userColors, userColorsOff, pinsByRepository };
  const keptAny = Object.values(kept).some((value) => value !== undefined);
  return {
    remembered: version >= 1 ? remembered : { ...remembered, dateRange: sincePresetOf(remembered.dateRange) ?? 'lastMonth', people: EVERYONE },
    kept: keptAny ? kept : null,
  };
}

/**
 * The views' hidden details once the Branch Explorer's remembered preferences are migrated: its own (`detailsKey`)
 * hidden when they were closed (`detailsOpen: false`), every other view's as it was.
 */
export function hiddenAfterMigration(persisted: unknown, hidden: Record<string, boolean>, detailsKey: string): Record<string, boolean> {
  const closed = (persisted as { detailsOpen?: unknown } | undefined)?.detailsOpen === false;
  return closed ? { ...hidden, [detailsKey]: true } : hidden;
}

/**
 * The preferences as they start: the remembered ones over the current defaults. A display option added after they
 * were remembered (`GraphViewOptions`) isn't among them, and starts at its default.
 */
export function rememberedPreferences<T extends object>(persisted: unknown, current: T): T {
  return { ...current, ...((persisted ?? {}) as Partial<T>) };
}
