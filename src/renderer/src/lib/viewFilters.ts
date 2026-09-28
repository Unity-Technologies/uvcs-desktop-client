import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EVERYONE, isEveryone, MINE, rememberedPick, type PeoplePick } from './peopleFilter';
import { sincePresetOf } from './sincePresets';

/** What every view's filter bar holds: the text typed and whose rows show; each view adds its time range and kinds. */
export interface ViewFilters {
  text: string;
  people: PeoplePick;
}

export interface ViewFilterActions<Filters> {
  update: (changes: Partial<Filters>) => void;
  /** "Clear filters": no text, everyone, and the view's kinds back to showing all. The time range stays. */
  clear: () => void;
}

/**
 * One store per view for its filters, remembered the same way everywhere: the time range, the kinds, the view
 * options and whether it shows only the user's rows are kept across sessions; the text typed and the people picked by
 * name (the repository's) are kept for the session. `cleared` holds what "Clear filters" resets besides the text and
 * the people: the kinds and statuses that narrow the list.
 */
export function createViewFilters<Filters extends ViewFilters>(name: string, defaults: Filters, cleared: Partial<Filters> = {}) {
  return create<Filters & ViewFilterActions<Filters>>()(
    persist(
      (set) =>
        ({
          ...defaults,
          update: (changes: Partial<Filters>) => set(changes as Partial<Filters & ViewFilterActions<Filters>>),
          clear: () => set(clearedFilters(cleared) as Partial<Filters & ViewFilterActions<Filters>>),
        }) as Filters & ViewFilterActions<Filters>,
      {
        name,
        version: 1,
        partialize: (state) => rememberedFilters(state),
        migrate: (persisted) => restoredFilters(persisted, defaults) as Filters & ViewFilterActions<Filters>,
      },
    ),
  );
}

/** What "Clear filters" sets. */
export function clearedFilters<Filters extends ViewFilters>(cleared: Partial<Filters>): Partial<Filters> {
  return { ...cleared, text: '', people: EVERYONE };
}

/** Whether "Clear filters" would show more: text typed, people picked, or a kind narrowing the list. */
export function isFiltering<Filters extends ViewFilters>(filters: Filters, cleared: Partial<Filters> = {}): boolean {
  if (filters.text.trim() !== '' || !isEveryone(filters.people)) return true;
  return (Object.keys(cleared) as (keyof Filters)[]).some((key) => filters[key] !== cleared[key]);
}

/** What is kept across sessions: everything but the text, the actions and the people picked by name. */
export function rememberedFilters<Filters extends ViewFilters>(state: Filters): Partial<Filters> {
  const kept = Object.fromEntries(Object.entries(state).filter(([key, value]) => key !== 'text' && typeof value !== 'function')) as Partial<Filters>;
  return { ...kept, people: rememberedPick(state.people) };
}

/**
 * Filters remembered before this store, or by an older one, as today's: `onlyMine` becomes the people's Mine, the
 * Branch Explorer's own date ranges become the shared presets, and what the view no longer has is dropped.
 */
export function restoredFilters<Filters extends ViewFilters>(persisted: unknown, defaults: Filters): Partial<Filters> {
  if (typeof persisted !== 'object' || persisted === null) return {};
  const old = persisted as Record<string, unknown>;
  const restored: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(old)) {
    if (!(key in defaults) || key === 'text') continue;
    const fallback = (defaults as Record<string, unknown>)[key];
    const since = typeof fallback === 'string' ? sincePresetOf(fallback) : undefined;
    if (since !== undefined) restored[key] = sincePresetOf(value) ?? fallback;
    else if (typeof value === typeof fallback) restored[key] = value;
  }
  if (typeof old.onlyMine === 'boolean') restored.people = old.onlyMine ? MINE : EVERYONE;
  if (restored.people !== undefined) restored.people = rememberedPick(restored.people as PeoplePick);
  return restored as Partial<Filters>;
}
