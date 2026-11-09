import { useMemo } from 'react';
import { referencesOfBlocks } from '../comments/remoteObjects';
import { issueKeysOf } from './issueKeysOf';
import { useIssueReads } from './useIssueReads';

/**
 * A comment shown in full reads its issues as it shows (`useIssueReads`), once what it shows stayed put: the rows an
 * arrow key passes through read nothing. Its chips then show their titles and statuses, and a bare `#12` found becomes
 * one.
 */
export function ResolvedIssues({ blocks }: { blocks: readonly unknown[] }): null {
  useIssueReads(useMemo(() => issueKeysOf(referencesOfBlocks(blocks)), [blocks]));
  return null;
}
