import { namesAnotherRepository, type SuggestionKind } from './suggestionTriggers';

/** A list query's state, as TanStack Query gives it. */
export interface ListRead<T> {
  data: readonly T[] | undefined;
  isPending: boolean;
  isError: boolean;
}

/** What a kind's suggestions rank, and where it stands. */
export interface Listed<T> {
  items: readonly T[];
  reading: boolean;
  failed: boolean;
}

/**
 * What a kind's suggestions come from (docs/features/rich-comments.md, "Suggestions"): the whole list once it is read
 * (every branch, every label); until then the server's search of what is typed (`searched`, one `cm find … like`
 * once typing settles), so a repository of 20,000 branches answers in the time of a search. A read failed says so
 * only once nothing else can answer: it never reads as a repository with none.
 */
export function listedFrom<T>(whole: ListRead<T>, searched: ListRead<T> | null): Listed<T> {
  if (whole.data) return { items: whole.data, reading: false, failed: false };
  if (searched?.data) return { items: searched.data, reading: false, failed: false };
  const reading = (whole.isPending && !whole.isError) || (searched !== null && searched.isPending && !searched.isError);
  return { items: NOTHING as readonly T[], reading, failed: !reading && whole.isError };
}

/**
 * Who a mention offers (docs/features/rich-comments.md, "Suggestions"): the people the lists show, and the server's
 * users: every one once Permissions read them all, else those holding the last text searched, kept while the text
 * changes (each key ranks them again, `holdsEveryWord` drops who no longer matches). A search that fails leaves the
 * people seen: it never reads as nobody.
 */
export function peopleListedFrom(seen: Listed<string>, users: { every: readonly string[] | undefined; searched: ListRead<string>; searching: boolean }): Listed<string> {
  const found = users.every ?? users.searched.data ?? NOTHING;
  const searchReading = users.searching && users.searched.isPending && !users.searched.isError;
  return { items: [...seen.items, ...found], reading: seen.reading || searchReading, failed: seen.failed };
}

/** A mention searches the server's users from this many letters: one lists almost every user of a big organization. */
const PERSON_SEARCH_MIN_LENGTH = 2;

/** One empty list for every read with nothing yet: what indexes a list (`branchIndex`) is built once for it. */
const NOTHING: readonly never[] = Object.freeze([]);

/** What a suggestion list asks the server for, by what is typed and what the window already read. */
export interface SuggestionReads {
  /** The newest 50 changesets (`suggestedChangesetsQuery`), for changesets and people. */
  fewChangesets: boolean;
  everyBranch: boolean;
  everyLabel: boolean;
  /** The server's search of the branch or label typed (`branchSearchQuery`, `labelSearchQuery`). */
  searchBranches: boolean;
  searchLabels: boolean;
  /** The server's users holding the name typed (`cm listusers --onlyusers --filter`), for a mention, from two letters. */
  searchPeople: boolean;
  shelves: boolean;
  codeReviews: boolean;
}

/**
 * What a suggestion list reads (docs/features/rich-comments.md, "Suggestions"): only for its trigger's kind; the
 * newest 50 changesets unless the palette's 2,000 are read already; every branch or label, and until it is read the
 * server's search of the text typed, once it settles (`settled`, as typed) and only when not empty: one find per
 * settled text, never one per key. A mention searches the server's users the same way, from two letters and until
 * Permissions read every one: the lists only hold people who own something in them.
 */
export function suggestionReads(state: { kind: SuggestionKind | undefined; typed: string; settled: string; paletteChangesetsRead: boolean; everyBranchRead: boolean; everyLabelRead: boolean; everyUserRead: boolean }): SuggestionReads {
  const { kind } = state;
  const searching = state.settled.trim() !== '' && state.settled === state.typed && !(kind !== undefined && namesAnotherRepository(kind, state.typed));
  return {
    fewChangesets: (kind === 'changeset' || kind === 'person') && !state.paletteChangesetsRead,
    everyBranch: kind === 'branch',
    everyLabel: kind === 'label',
    searchBranches: kind === 'branch' && searching && !state.everyBranchRead,
    searchLabels: kind === 'label' && searching && !state.everyLabelRead,
    searchPeople: kind === 'person' && searching && state.settled.trim().length >= PERSON_SEARCH_MIN_LENGTH && !state.everyUserRead,
    shelves: kind === 'shelve',
    codeReviews: kind === 'codeReview',
  };
}

/**
 * The cue on the word typed after a trigger, apart from the list: so the field shows it understood `br:` whatever the
 * list does. `reading` pulses while the kind's list is read; nothing once the list is closed (Esc) or the word picked.
 */
export function suggestionCue(state: { recognized: boolean; dismissed: boolean; reading: boolean }): 'reading' | 'ready' | null {
  if (!state.recognized || state.dismissed) return null;
  return state.reading ? 'reading' : 'ready';
}
