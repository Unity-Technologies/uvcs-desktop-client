interface Section<Entry> {
  entries: readonly Entry[];
}

/**
 * The sections of the home screen's lists to show: all of them without a search, each with its own empty state;
 * during one, or while another filter narrows them (`narrowed`: a place picked), only those with matches, so a
 * search that finds nothing says it once instead of once per section, never that there is nothing yet.
 */
export function searchedSections<S extends Section<unknown>>(sections: readonly S[], query: string, narrowed = false): readonly S[] {
  return query.trim() || narrowed ? sections.filter((section) => section.entries.length > 0) : sections;
}

/** What Enter in the search field opens: the first match, in the order the list shows them. */
export function firstMatch<Entry>(sections: readonly Section<Entry>[]): Entry | undefined {
  return sections.find((section) => section.entries.length > 0)?.entries[0];
}
