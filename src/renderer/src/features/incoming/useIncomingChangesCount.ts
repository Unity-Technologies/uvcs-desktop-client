import { useIncomingSummary } from './useIncomingSummary';

/** Number of changesets on the loaded branch that the workspace does not have yet. */
export function useIncomingChangesCount(): number | undefined {
  return useIncomingSummary().data?.changesetCount;
}
