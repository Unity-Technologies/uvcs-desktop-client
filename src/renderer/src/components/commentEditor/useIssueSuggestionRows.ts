import { queryOptions, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { IssueRead, IssueSearch, IssueSearchAnswer } from '@shared/domain/issueTrackers';
import { TRACKER_GRAMMARS } from '@shared/issueTrackers/trackerGrammars';
import { api } from '../../api/client';
import { SERVER_SEARCH_DELAY_MS } from '../../app/commands/usePaletteServerSearch';
import { usePlaceRepository } from '../../app/workspace/useWorkspace';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { issueKeys, issueQuery } from '../issues/issueQueries';
import { usePlaceTracker } from '../issues/useIssueTrackers';
import { issueSearchStaleTime, issueSuggestionReads, issueSuggestionRows, type SearchRead } from './issueSuggestions';
import type { Suggestion } from './suggestionItems';
import type { SuggestionRow } from './suggestionRows';

const NO_ROWS: SuggestionRow[] = [];

/**
 * A `#` search of the repository's issues, cached per words (`IssueSearch`; none: the account's open issues): typing
 * the same words again asks nothing while fresh (`issueSearchStaleTime`). Never read again on focus, a reconnect or a
 * failure: the next `#` does.
 */
export function issueSearchQuery(repository: string, search: IssueSearch) {
  return queryOptions({
    queryKey: [...issueKeys.searches, repository, search.words ?? ''] as const,
    queryFn: () => api.issueTrackers.searchIssues(repository, search),
    staleTime: (query) => issueSearchStaleTime(query.state.data, Date.now()),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

/**
 * The issue list's rows for what's typed after `#` (null: the list isn't open), from the place's tracker
 * (docs/features/issue-trackers.md, "Suggesting issues"): the account's open issues read once it opens, a key typed
 * read through the batched reads, words searched once typing settles (`issueSuggestionReads`). `picked` hands a
 * picked issue to its chip, so it shows read at once.
 */
export function useIssueSuggestionRows(typed: string | null): { rows: SuggestionRow[]; picked: (suggestion: Suggestion) => void } {
  const tracker = usePlaceTracker();
  const repository = usePlaceRepository() ?? '';
  const queryClient = useQueryClient();
  const settled = useDebouncedValue(typed ?? '', SERVER_SEARCH_DELAY_MS);
  const open = typed !== null && tracker !== null && repository !== '';
  const needsSignIn = tracker !== null && (tracker.connection.credential === 'refused' || tracker.connection.credential === 'missing');
  const asking = open && !needsSignIn;
  const reads = open ? issueSuggestionReads(tracker.reader, typed, settled) : { words: null, key: null };
  const mine = useQuery({ ...issueSearchQuery(repository, {}), enabled: asking });
  const words = useQuery({ ...issueSearchQuery(repository, { words: reads.words ?? '' }), enabled: asking && reads.words !== null });
  const keyed = useQuery({ ...issueQuery(tracker?.connection.id ?? '', reads.key ?? ''), enabled: asking && reads.key !== null });

  const picked = (suggestion: Suggestion): void => {
    if (!tracker || !suggestion.issue) return;
    const read: IssueRead = { key: suggestion.issue.key, kind: 'found', issue: suggestion.issue };
    queryClient.setQueryData(issueKeys.issue(tracker.connection.id, read.key), read);
  };
  if (!open) return { rows: NO_ROWS, picked };
  const rows = issueSuggestionRows({
    typed,
    reader: tracker.reader,
    trackerName: TRACKER_GRAMMARS[tracker.connection.kind].name,
    needsSignIn,
    mine: searchRead(mine),
    words: reads.words !== null ? searchRead(words) : null,
    keyed: reads.key !== null ? { key: reads.key, read: keyed.isError ? { key: reads.key, kind: 'unreadable', reason: 'unexpected' } : keyed.data } : null,
  });
  return { rows, picked };
}

/** A search's query as the rows read it: a call that failed on its way (IPC) is a failed search. */
function searchRead(query: UseQueryResult<IssueSearchAnswer>): SearchRead {
  return { answer: query.isError ? { kind: 'failed', reason: 'unexpected' } : query.data, pending: query.isFetching };
}
