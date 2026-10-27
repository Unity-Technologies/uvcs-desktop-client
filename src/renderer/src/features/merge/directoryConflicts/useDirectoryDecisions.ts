import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { directoryConflictIdentity } from '@shared/domain/directoryConflictIdentity';
import type { DecidedMerge, DirectoryConflict, DirectoryConflictResolution, MergePlan, MergeRequest } from '@shared/domain/merge';
import { api } from '../../../api/client';
import { applyDirectoryDecision } from './applyDirectoryDecision';
import { isDecidedAs, resolutionsByConflict } from './directoryDecisions';

/**
 * The merge page's directory decisions, applied as the user makes them, as the official client does: each one is sent
 * with those before it (`applyDirectoryDecision`), and the merge `cm` calculates again on them becomes the page's plan,
 * where a decision may have moved, removed or added file conflicts and changes. One is applied at a time. The main
 * process keeps them, named by the page, until it closes.
 */
export function useDirectoryDecisions(workspacePath: string, request: MergeRequest, initialPlan: MergePlan) {
  const [decisionsId] = useState(() => crypto.randomUUID());
  const [decided, setDecided] = useState<DecidedMerge>({ plan: initialPlan, decisions: [] });
  const [applying, setApplying] = useState<string | null>(null);
  const latest = useRef({ decided, applying });
  latest.current = { decided, applying };

  useEffect(() => () => void api.merge.discardDirectoryDecisions(decisionsId), [decisionsId]);

  const decide = useCallback(
    async (conflict: DirectoryConflict, resolution: DirectoryConflictResolution): Promise<DecidedMerge | null> => {
      if (latest.current.applying !== null || isDecidedAs(latest.current.decided.decisions, conflict, resolution)) return null;
      latest.current.applying = directoryConflictIdentity(conflict);
      setApplying(latest.current.applying);
      const merge = await applyDirectoryDecision(workspacePath, request, decisionsId, latest.current.decided.decisions, conflict, resolution);
      latest.current.applying = null;
      setApplying(null);
      if (merge) setDecided(merge);
      return merge;
    },
    [workspacePath, request, decisionsId],
  );

  const resolutions = useMemo(() => resolutionsByConflict(decided.decisions), [decided.decisions]);
  return {
    plan: decided.plan,
    decisions: decided.decisions,
    /** Each decided conflict's resolution, by its identity (`directoryConflictIdentity`). */
    resolutions,
    /** The identity of the conflict whose decision is being applied, if one is. */
    applying,
    /** What the merge goes on from (`MergeResolutions.directoryDecisionsId`); none before any decision. */
    decisionsId: decided.decisions.length > 0 ? decisionsId : undefined,
    /** Applies a decision; resolves with the merge it leaves, or null when it changed nothing or failed. */
    decide,
  };
}
