/** A row of a `PickFilter`'s list: the choice that filters nothing ("All projects"), or one of the choices. */
export type PickFilterItem<Choice> = { kind: 'all' } | { kind: 'choice'; choice: Choice };

const ALL: PickFilterItem<never> = { kind: 'all' };

/**
 * The rows a `PickFilter` lists: the choice that filters nothing first, then the choices the search finds; while
 * searching, only those, as "All projects" isn't what was typed.
 */
export function pickFilterItems<Choice>(matching: readonly Choice[], search: string): PickFilterItem<Choice>[] {
  const choices = matching.map((choice): PickFilterItem<Choice> => ({ kind: 'choice', choice }));
  return search.trim() ? choices : [ALL, ...choices];
}
