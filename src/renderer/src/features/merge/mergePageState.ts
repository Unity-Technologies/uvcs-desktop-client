import type { MergePlan } from '@shared/domain/merge';
import type { MergeCompletion } from './MergeCompleted';
import { mergeRuleRefusal, type MergeRuleRefusal } from './mergeRuleRefusal';

/** What the merge page shows (`MergePage`), from where its preview and the merge stand. */
export type MergePageState =
  | { kind: 'completed'; completion: MergeCompletion }
  | { kind: 'calculating' }
  | { kind: 'refused'; refusal: MergeRuleRefusal }
  | { kind: 'failed' }
  | { kind: 'notPossible'; plan: MergePlan }
  | { kind: 'ready'; plan: MergePlan };

interface MergePageFacts {
  /** Merged into the workspace: the plan no longer holds. */
  completion: MergeCompletion | undefined;
  isLoading: boolean;
  error: Error | null;
  plan: MergePlan | undefined;
}

/**
 * The page's state, in order: once merged, what happened; while previewed, calculating; a preview the server's merge
 * rules refused (they're checked while a merge into a branch is calculated), the rule explained; any other failure as
 * `cm` says it; a plan that can't be merged, why; else the merge to decide.
 */
export function mergePageStateOf({ completion, isLoading, error, plan }: MergePageFacts): MergePageState {
  if (completion) return { kind: 'completed', completion };
  if (isLoading) return { kind: 'calculating' };
  const refusal = error ? mergeRuleRefusal(error.message) : undefined;
  if (refusal) return { kind: 'refused', refusal };
  if (error || !plan) return { kind: 'failed' };
  return plan.status === 'ready' ? { kind: 'ready', plan } : { kind: 'notPossible', plan };
}
