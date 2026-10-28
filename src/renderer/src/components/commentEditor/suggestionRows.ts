import type { Suggestion } from './suggestionItems';
import type { SuggestionQuery } from './suggestionTrigger';
import type { SuggestionKind } from './suggestionTriggers';

/** A row of the suggestion list: something to pick, the search of every changeset to start, or a word on where it stands. */
export type SuggestionRow =
  | { kind: 'pick'; suggestion: Suggestion }
  /** "Search all changesets for “x”": the comments of the changesets past the newest ones read, searched only if picked. */
  | { kind: 'searchAll'; text: string }
  /** Where things stand; `pending` while something is being read, drawn with a spinner. */
  | { kind: 'note'; text: string; pending?: boolean };

/** The list a kind's suggestions come from: what it ranked, and whether it's still being read. */
export interface SuggestionSource {
  suggestions: readonly Suggestion[];
  reading: boolean;
  /** Its list couldn't be read: said so, never as a repository with none. The trigger typed again reads again. */
  failed: boolean;
}

/** A changeset's number typed that the newest ones don't hold, looked up once typing settles. */
export type ChangesetLookup = { state: 'none' } | { state: 'reading'; id: number } | { state: 'found'; suggestion: Suggestion } | { state: 'missing'; id: number };

/** The search of every changeset's comment, for the text it was started with. */
export type ChangesetSearch = { state: 'none' } | { state: 'searching'; text: string } | { state: 'found'; text: string; suggestions: readonly Suggestion[] };

const NOUNS: Record<SuggestionKind, string> = {
  changeset: 'changesets',
  branch: 'branches',
  label: 'labels',
  shelve: 'shelves',
  codeReview: 'code reviews',
  person: 'people',
  emoji: 'emoji',
};

/**
 * The rows the list shows (docs/features/rich-comments.md, "Suggestions"). Emoji offer only matches: no row at all
 * closes the list, as a colon in a sentence opens nothing. Changesets add the exact number looked up, or the search of
 * them all for words the newest don't match.
 */
export function suggestionRows(kind: SuggestionKind, typed: string, source: SuggestionSource, changesets?: { lookup: ChangesetLookup; search: ChangesetSearch }): SuggestionRow[] {
  const picks: SuggestionRow[] = source.suggestions.map((suggestion) => ({ kind: 'pick', suggestion }));
  if (kind === 'emoji') return picks;
  if (source.reading && picks.length === 0) return [{ kind: 'note', text: `Reading ${NOUNS[kind]}…`, pending: true }];
  if (source.failed && picks.length === 0) return [{ kind: 'note', text: `Couldn't read ${NOUNS[kind]}` }];
  const extra = changesets && !source.reading ? changesetRows(typed, source.suggestions, changesets) : [];
  const rows = [...picks, ...extra];
  if (rows.length > 0) return rows;
  return [{ kind: 'note', text: typed ? `No ${NOUNS[kind]} match “${typed}”` : `No ${NOUNS[kind]}` }];
}

function changesetRows(typed: string, listed: readonly Suggestion[], { lookup, search }: { lookup: ChangesetLookup; search: ChangesetSearch }): SuggestionRow[] {
  if (/^\d+$/.test(typed)) {
    if (listed.some((suggestion) => suggestion.label === typed)) return [];
    switch (lookup.state) {
      case 'reading':
        return [{ kind: 'note', text: `Looking up changeset ${lookup.id}…`, pending: true }];
      case 'found':
        return [{ kind: 'pick', suggestion: lookup.suggestion }];
      case 'missing':
        return [{ kind: 'note', text: `No changeset ${lookup.id}` }];
      default:
        return [];
    }
  }
  if (!typed.trim()) return [];
  if (search.state === 'searching' && search.text === typed) return [{ kind: 'note', text: 'Searching all changesets…', pending: true }];
  if (search.state === 'found' && search.text === typed) {
    const shown = new Set(listed.map((suggestion) => suggestion.key));
    return search.suggestions.filter((suggestion) => !shown.has(suggestion.key)).map((suggestion) => ({ kind: 'pick', suggestion }));
  }
  return [{ kind: 'searchAll', text: typed }];
}

/** The rows that can be highlighted and picked with the keys: a note only says where things stand. */
export function isPickable(row: SuggestionRow): boolean {
  return row.kind !== 'note';
}

/** The next pickable row from `index` in `step`'s direction, wrapping around; -1 when none is. */
export function nextPickable(rows: readonly SuggestionRow[], index: number, step: 1 | -1): number {
  for (let offset = 1; offset <= rows.length; offset++) {
    const candidate = (index + step * offset + rows.length * 2) % rows.length;
    if (isPickable(rows[candidate]!)) return candidate;
  }
  return -1;
}

/** What a key does while the list shows: null leaves it to the text (the caret, a new line, the window). */
export type SuggestionKeyAction = { kind: 'move'; to: number } | { kind: 'pick'; index: number } | { kind: 'dismiss' };

export interface KeyModifiers {
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * The list's keys, taken before the field's: up and down move through what can be picked (with nothing to pick, the
 * caret moves), Enter or Tab picks the row the keys are at (only with no modifier: Cmd+Enter is the field's), Esc
 * closes the list.
 */
export function suggestionKeyAction(key: string, modifiers: KeyModifiers, rows: readonly SuggestionRow[], active: number): SuggestionKeyAction | null {
  const plain = !modifiers.metaKey && !modifiers.ctrlKey && !modifiers.altKey && !modifiers.shiftKey;
  switch (key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      if (!plain) return null;
      const to = nextPickable(rows, active, key === 'ArrowDown' ? 1 : -1);
      return to < 0 ? null : { kind: 'move', to };
    }
    case 'Enter':
    case 'Tab':
      return plain && rows[active] && isPickable(rows[active]) ? { kind: 'pick', index: active } : null;
    case 'Escape':
      return { kind: 'dismiss' };
    default:
      return null;
  }
}

/** Whether Esc closed the list on this word (`dismissedAt`: where it started): it opens again for another one. */
export function isDismissed(query: SuggestionQuery, dismissedAt: number | null): boolean {
  return dismissedAt !== null && query.from === dismissedAt;
}
