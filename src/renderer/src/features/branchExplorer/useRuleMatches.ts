import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { usePlace } from '../../app/workspace/useWorkspace';
import { ruleQueries, type ExplorerRule } from './model/explorerRules';
import { ruleMatchesOf, shownRuleMatches, type RuleMatches } from './model/ruleMatches';

/**
 * What the server says each rule's condition matches: one `cm find` per distinct question, asked only when a rule
 * asks one. The key sits under the explorer's own area ('branchExplorer'), so whatever refreshes the graph (a new
 * branch, a label, a checkin, Refresh) asks again too. While a changed rule waits for its answer, the earlier answers
 * keep applying and the new rule takes part once it arrives. The finds have no range or limit, on purpose: why at
 * `matchRules`.
 */
export function useRuleMatches(rules: readonly ExplorerRule[]): RuleMatches {
  const place = usePlace();
  const queries = useMemo(() => ruleQueries(rules), [rules]);
  const { data } = useQuery({
    queryKey: queryKeys.inPlace(place, 'branchExplorer', 'rules', queries),
    queryFn: () => api.branchExplorer.matchRules(place, queries).then((answers) => ruleMatchesOf(queries, answers)),
    enabled: queries.length > 0,
    placeholderData: (previous) => previous,
    staleTime: SLOW_CHANGING_QUERY.staleTime,
  });
  return shownRuleMatches(queries.length, data);
}
