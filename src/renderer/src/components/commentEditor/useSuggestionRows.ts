import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { placeId } from '@shared/domain/place';
import { everyBranchQuery, everyLabelQuery, recentShelvesQuery } from '../../app/commands/paletteQueries';
import { branchSearchQuery, labelSearchQuery, SERVER_SEARCH_DELAY_MS, useChangesetSearch } from '../../app/commands/usePaletteServerSearch';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { usePlace, usePlaceRepository } from '../../app/workspace/useWorkspace';
import { recentChangesetsQuery, suggestedChangesetsQuery } from '../../features/changesets/recentChangesets';
import { useChangeset } from '../../features/changesets/useChangeset';
import { reviewSummariesQuery } from '../../features/codeReviews/useCodeReviews';
import { peopleSeenIn } from '../people/usePeopleSeen';
import { changesetToLookUp } from './changesetLookup';
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
import { listedFrom, suggestionReads, type ListRead, type Listed } from './suggestionSource';
import type { SuggestionQuery } from './suggestionTrigger';

const NO_ROWS: SuggestionRow[] = [];

/**
 * The suggestion list's rows for what is typed (docs/features/rich-comments.md, "Suggestions"). Each kind reads the
 * list the palette and the views share, under the same query key, only once its trigger is typed. Changesets: the
 * palette's newest 2,000 when cached, else the newest 50 (`suggestedChangesetsQuery`). Branches and labels: the whole
 * list, and the server's search of what is typed until it is read (`listedFrom`). People come from the owners of
 * those lists and everyone the place's lists showed; a changeset past the newest ones is looked up by its number once
 * typing settles, or found by "Search all changesets", which searches only when picked.
 */
export function useSuggestionRows(query: SuggestionQuery | null): { rows: SuggestionRow[]; reading: boolean; searchAll: (text: string) => void } {
  const place = usePlace();
  const placeRepository = usePlaceRepository();
  const kind = query?.kind;
  const typed = query?.text ?? '';
  // The palette's newest 2,000 changesets and every branch and label, as far as the window already read them.
  const paletteChangesets = useQuery({ ...recentChangesetsQuery(place), enabled: false });
  const term = useDebouncedValue(typed, SERVER_SEARCH_DELAY_MS);

  // Whether every branch or label is read already, from the cache: the queries below observe them.
  const queryClient = useQueryClient();
  const everyBranchRead = queryClient.getQueryData(everyBranchQuery(place).queryKey) !== undefined;
  const everyLabelRead = queryClient.getQueryData(everyLabelQuery(place).queryKey) !== undefined;
  const reads = suggestionReads({ kind, typed, settled: term, paletteChangesetsRead: paletteChangesets.data !== undefined, everyBranchRead, everyLabelRead });
  const fewChangesets = useQuery({ ...suggestedChangesetsQuery(place), enabled: reads.fewChangesets });
  const changesets = paletteChangesets.data ? paletteChangesets : fewChangesets;
  const everyBranch = useQuery({ ...everyBranchQuery(place), enabled: reads.everyBranch });
  const everyLabel = useQuery({ ...everyLabelQuery(place), enabled: reads.everyLabel });
  const searchedBranches = useQuery({ ...branchSearchQuery(place, term), enabled: reads.searchBranches });
  const searchedLabels = useQuery({ ...labelSearchQuery(place, term), enabled: reads.searchLabels });
  // Kept while what they're made of is: the indexes and rankings below are built once per read, not at each render.
  const branchesListed = useListed(everyBranch, reads.searchBranches ? searchedBranches : null);
  const labelsListed = useListed(everyLabel, reads.searchLabels ? searchedLabels : null);
  const changesetsListed = useListed(changesets, null);
  const shelves = useQuery({ ...recentShelvesQuery(place), enabled: reads.shelves });
  const reviews = useQuery({ ...reviewSummariesQuery(place), enabled: reads.codeReviews });

  // Each list read into an index once per read: a key typed walks no object.
  const changesetsIndex = useMemo(() => changesetIndex(changesetsListed.items), [changesetsListed.items]);
  const branchesIndex = useMemo(() => branchIndex(branchesListed.items), [branchesListed.items]);
  const labelsIndex = useMemo(() => labelIndex(labelsListed.items), [labelsListed.items]);
  const shelvesIndex = useMemo(() => shelveIndex(shelves.data ?? []), [shelves.data]);
  const reviewsIndex = useMemo(() => codeReviewIndex(reviews.data ?? []), [reviews.data]);
  const peopleIndex = useMemo(
    () =>
      kind === 'person'
        ? personIndex([
            ...changesetsListed.items.map((changeset) => changeset.owner),
            ...(everyBranch.data ?? []).map((branch) => branch.owner),
            ...(everyLabel.data ?? []).map((label) => label.owner),
            ...(shelves.data ?? []).map((shelve) => shelve.owner),
            ...(reviews.data ?? []).flatMap((review) => [review.owner, review.assignee].filter(Boolean)),
            ...peopleSeenIn(placeId(place)),
          ])
        : null,
    [kind, changesetsListed.items, everyBranch.data, everyLabel.data, shelves.data, reviews.data, place],
  );

  const listed = useMemo(() => {
    switch (kind) {
      case 'changeset':
        return { suggestions: changesetSuggestions(changesetsIndex, typed), reading: changesetsListed.reading, failed: changesetsListed.failed };
      case 'branch':
        return { suggestions: branchSuggestions(branchesIndex, typed, placeRepository), reading: branchesListed.reading, failed: branchesListed.failed };
      case 'label':
        return { suggestions: labelSuggestions(labelsIndex, typed, placeRepository), reading: labelsListed.reading, failed: labelsListed.failed };
      case 'shelve':
        return { suggestions: shelveSuggestions(shelvesIndex, typed), reading: shelves.isPending && !shelves.isError, failed: shelves.isError };
      case 'codeReview':
        return { suggestions: codeReviewSuggestions(reviewsIndex, typed), reading: reviews.isPending && !reviews.isError, failed: reviews.isError };
      case 'person':
        return { suggestions: peopleIndex ? personSuggestions(peopleIndex, typed) : [], reading: changesetsListed.reading, failed: changesetsListed.failed };
      case 'emoji':
        return { suggestions: emojiSuggestions(typed), reading: false, failed: false };
      default:
        return null;
    }
  }, [kind, typed, changesetsIndex, branchesIndex, labelsIndex, shelvesIndex, reviewsIndex, peopleIndex, placeRepository, changesetsListed, branchesListed, labelsListed, shelves.isPending, shelves.isError, reviews.isPending, reviews.isError]);

  const lookup = useChangesetLookup(kind === 'changeset' && changesets.data !== undefined ? typed : null, listed?.suggestions ?? []);
  const reading = listed?.reading ?? false;
  const search = useChangesetSearch(place);
  const searched: ChangesetSearch =
    search.term === undefined ? { state: 'none' } : search.found.data ? { state: 'found', text: search.term, suggestions: search.found.data.slice(0, SUGGESTION_LIMIT).map(changesetSuggestion) } : { state: 'searching', text: search.term };

  // The best few rows: cheap to lay out again on each render.
  const rows = listed && kind ? suggestionRows(kind, typed, listed, kind === 'changeset' ? { lookup, search: searched } : undefined) : NO_ROWS;
  return { rows, reading, searchAll: (text) => search.start(text) };
}

/**
 * A changeset's number the newest ones don't hold, looked up once typing stops on it (`useDebouncedValue`, as the palette's search waits): one read for
 * the number stopped at, cached as the changeset is (`useChangeset`), never one per digit typed.
 */
function useChangesetLookup(typed: string | null, listed: readonly { label: string }[]): ChangesetLookup {
  const number = typed === null ? null : changesetToLookUp(typed, listed);
  const settled = useDebouncedValue(number, SERVER_SEARCH_DELAY_MS);
  const found = useChangeset(settled !== null && settled === number ? settled : null);
  if (number === null) return { state: 'none' };
  if (found.data && found.data.id === number) return { state: 'found', suggestion: changesetSuggestion(found.data) };
  if (found.isError && settled === number) return { state: 'missing', id: number };
  return { state: 'reading', id: number };
}

/** `listedFrom`, the same object while its items and state are: what ranks it is memoized on it. */
function useListed<T>(whole: ListRead<T>, searched: ListRead<T> | null): Listed<T> {
  const listed = listedFrom(whole, searched);
  return useMemo(() => listed, [listed.items, listed.reading, listed.failed]);
}
