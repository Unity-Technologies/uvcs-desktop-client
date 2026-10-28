import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { placeId } from '@shared/domain/place';
import type { QueryFilter } from '@shared/domain/query';
import { api } from '../../api/client';
import { branchesKey, labelsKey, shelvesKey } from '../../app/commands/paletteQueryKeys';
import { useChangesetSearch } from '../../app/commands/usePaletteServerSearch';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { usePlace, usePlaceRepository } from '../../app/workspace/useWorkspace';
import { recentChangesetsQuery } from '../../features/changesets/recentChangesets';
import { useChangeset } from '../../features/changesets/useChangeset';
import { reviewSummariesQuery } from '../../features/codeReviews/useCodeReviews';
import { sinceDateFor } from '../../lib/sincePresets';
import { useSettledValue } from '../../lib/useSettled';
import { peopleSeenIn } from '../people/usePeopleSeen';
import {
  branchIndex,
  branchSuggestions,
  changesetIndex,
  changesetSuggestion,
  changesetSuggestions,
  codeReviewIndex,
  codeReviewSuggestions,
  emojiSuggestions,
  labelIndex,
  labelSuggestions,
  personIndex,
  personSuggestions,
  shelveIndex,
  shelveSuggestions,
  SUGGESTION_LIMIT,
} from './suggestionItems';
import { suggestionRows, type ChangesetLookup, type ChangesetSearch, type SuggestionRow } from './suggestionRows';
import type { SuggestionKind, SuggestionQuery } from './suggestionTrigger';

/** The palette's recent shelves (`usePaletteLists`): one query and one cache entry for both. */
const RECENT_SHELVES: QueryFilter = { sinceDate: sinceDateFor('last3Months') };

const NO_ROWS: SuggestionRow[] = [];

/**
 * The suggestion list's rows for what is typed (docs/features/rich-comments.md, "Suggestions"). No command of its
 * own: each kind reads the list the palette and the views already share, under the same query key, and only once its
 * trigger is typed. People come from the owners of those lists and everyone the place's lists showed; a changeset
 * past the newest ones is looked up by its number once typing settles, or found by "Search all changesets", which
 * searches only when picked.
 */
export function useSuggestionRows(query: SuggestionQuery | null): { rows: SuggestionRow[]; searchAll: (text: string) => void } {
  const place = usePlace();
  const placeRepository = usePlaceRepository();
  const kind = query?.kind;
  const typed = query?.text ?? '';
  const asks = (...kinds: SuggestionKind[]) => kind !== undefined && kinds.includes(kind);

  // A mention reads the newest changesets for their authors; the other lists it only reads when they're cached.
  const changesets = useQuery({ ...recentChangesetsQuery(place), enabled: asks('changeset', 'person') });
  const branches = useQuery({ queryKey: branchesKey(place, {}), queryFn: () => api.branches.list(place, {}), ...SLOW_CHANGING_QUERY, enabled: asks('branch') });
  const labels = useQuery({ queryKey: labelsKey(place, {}), queryFn: () => api.labels.list(place, {}), ...SLOW_CHANGING_QUERY, enabled: asks('label') });
  const shelves = useQuery({ queryKey: shelvesKey(place, RECENT_SHELVES), queryFn: () => api.shelves.list(place, RECENT_SHELVES), ...SLOW_CHANGING_QUERY, enabled: asks('shelve') });
  const reviews = useQuery({ ...reviewSummariesQuery(place), enabled: asks('codeReview') });

  // Each list read into an index once per read: a key typed walks no object.
  const changesetsIndex = useMemo(() => changesetIndex(changesets.data ?? []), [changesets.data]);
  const branchesIndex = useMemo(() => branchIndex(branches.data ?? []), [branches.data]);
  const labelsIndex = useMemo(() => labelIndex(labels.data ?? []), [labels.data]);
  const shelvesIndex = useMemo(() => shelveIndex(shelves.data ?? []), [shelves.data]);
  const reviewsIndex = useMemo(() => codeReviewIndex(reviews.data ?? []), [reviews.data]);
  const peopleIndex = useMemo(
    () =>
      kind === 'person'
        ? personIndex([
            ...(changesets.data ?? []).map((changeset) => changeset.owner),
            ...(branches.data ?? []).map((branch) => branch.owner),
            ...(labels.data ?? []).map((label) => label.owner),
            ...(shelves.data ?? []).map((shelve) => shelve.owner),
            ...(reviews.data ?? []).flatMap((review) => [review.owner, review.assignee].filter(Boolean)),
            ...peopleSeenIn(placeId(place)),
          ])
        : null,
    [kind, changesets.data, branches.data, labels.data, shelves.data, reviews.data, place],
  );

  const listed = useMemo(() => {
    switch (kind) {
      case 'changeset':
        return { suggestions: changesetSuggestions(changesetsIndex, typed), reading: changesets.isPending };
      case 'branch':
        return { suggestions: branchSuggestions(branchesIndex, typed, placeRepository), reading: branches.isPending };
      case 'label':
        return { suggestions: labelSuggestions(labelsIndex, typed, placeRepository), reading: labels.isPending };
      case 'shelve':
        return { suggestions: shelveSuggestions(shelvesIndex, typed), reading: shelves.isPending };
      case 'codeReview':
        return { suggestions: codeReviewSuggestions(reviewsIndex, typed), reading: reviews.isPending };
      case 'person':
        return { suggestions: peopleIndex ? personSuggestions(peopleIndex, typed) : [], reading: changesets.isPending };
      case 'emoji':
        return { suggestions: emojiSuggestions(typed), reading: false };
      default:
        return null;
    }
  }, [kind, typed, changesetsIndex, branchesIndex, labelsIndex, shelvesIndex, reviewsIndex, peopleIndex, placeRepository, changesets.isPending, branches.isPending, labels.isPending, shelves.isPending, reviews.isPending]);

  const lookup = useChangesetLookup(kind === 'changeset' && changesets.data !== undefined ? typed : null, listed?.suggestions ?? []);
  const search = useChangesetSearch(place);
  const searched: ChangesetSearch =
    search.term === undefined ? { state: 'none' } : search.found.data ? { state: 'found', text: search.term, suggestions: search.found.data.slice(0, SUGGESTION_LIMIT).map(changesetSuggestion) } : { state: 'searching', text: search.term };

  // The best few rows: cheap to lay out again on each render.
  const rows = listed && kind ? suggestionRows(kind, typed, listed, kind === 'changeset' ? { lookup, search: searched } : undefined) : NO_ROWS;
  return { rows, searchAll: (text) => search.start(text) };
}

/**
 * A changeset's number the newest ones don't hold, looked up once typing settles (`useSettledValue`): one read for
 * the number stopped at, cached as the changeset is (`useChangeset`), never one per digit typed.
 */
function useChangesetLookup(typed: string | null, listed: readonly { label: string }[]): ChangesetLookup {
  const number = typed !== null && /^\d+$/.test(typed) && !listed.some((suggestion) => suggestion.label === typed) ? Number(typed) : null;
  const settled = useSettledValue(number, String(number));
  const found = useChangeset(settled !== null && settled === number ? settled : null);
  if (number === null) return { state: 'none' };
  if (found.data && found.data.id === number) return { state: 'found', suggestion: changesetSuggestion(found.data) };
  if (found.isError && settled === number) return { state: 'missing', id: number };
  return { state: 'reading', id: number };
}
