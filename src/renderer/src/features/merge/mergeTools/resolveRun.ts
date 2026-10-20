import { SMART_MERGE_NAME, type MergeTool } from '@shared/domain/mergeTools';
import { fileNameOf, listNames, pluralize } from '../../../lib/text';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { waitsForTool } from './mergeToolOutcome';

/** Resolving the files that wait for the user in one merge tool, one after the other. */
export interface RunPlan {
  tool: MergeTool;
  /** The files it opens, in the list's order. */
  keys: string[];
  /** Binary files waiting for the user, which no tool opens: left to them. */
  left: FileConflictState[];
}

/** What the tool would go through now. */
export function planRun(states: FileConflictState[], tool: MergeTool): RunPlan {
  const waiting = states.filter((state) => state.status === 'ready' && !state.resolution && !state.openTool);
  return {
    tool,
    keys: waiting.filter(waitsForTool).map((state) => state.file.key),
    left: waiting.filter((state) => !waitsForTool(state)),
  };
}

/**
 * The runs on offer, the preferred tool's first (else the first tool's), while any file waits for a tool; none
 * otherwise.
 */
export function runPlans(states: FileConflictState[], tools: MergeTool[], preferredId: string | null): RunPlan[] {
  const plans = tools.map((tool) => planRun(states, tool)).filter((plan) => plan.keys.length > 0);
  const first = plans.find((plan) => plan.tool.id === preferredId) ?? plans[0];
  return first ? [first, ...plans.filter((plan) => plan !== first)] : [];
}

/** Why some files stay out of the run, e.g. "Binary files keep one version: logo.png is left to you". */
export function leftOutNote(plan: RunPlan): string | undefined {
  if (plan.left.length === 0) return undefined;
  const names = listNames(plan.left.map((state) => fileNameOf(state.file.path)));
  return `Binary files keep one version: ${names} ${plan.left.length === 1 ? 'is' : 'are'} left to you`;
}

/** A run under way: the file open (or the one closed unsaved, while it asks whether to go on). */
export interface RunProgress {
  toolName: string;
  total: number;
  /** 0-based, in the run's files. */
  position: number;
  currentKey: string;
  /** Closed in the tool without saving: waits for the user to go on or stop. */
  paused: boolean;
}

/** "Resolving 2 of 5". */
export function runPositionText(progress: RunProgress): string {
  return `${progress.position + 1} of ${progress.total}`;
}

export interface RunEnding {
  resolved: number;
  /** Of those resolved, the Unity assets Smart Merge merged before the tool would open. */
  withSmartMerge: number;
  total: number;
  /** Stopped by the user before the last file. */
  stopped: boolean;
}

/**
 * The toast once the run ends: "Resolved 4 of 5 in FakeMerge", "1 still needs you", and what it left out; stopped
 * before any, just that. What Smart Merge merged is told apart: "Resolved all 3 conflicts: 2 with Smart Merge, 1 in
 * VS Code".
 */
export function runSummary(ending: RunEnding, plan: RunPlan): { kind: 'success' | 'info'; title: string; detail?: string } {
  const { resolved, total, stopped } = ending;
  const tool = plan.tool.name;
  const waiting = total - resolved;
  const by = resolvedBy(ending, tool);
  const title =
    resolved === total
      ? `Resolved ${allOf(total)}${by}`
      : stopped && resolved === 0
        ? `Stopped resolving in ${tool}`
        : `${stopped ? 'Stopped: resolved' : 'Resolved'} ${resolved} of ${total}${by}`;
  const detail = [waiting > 0 && `${waiting} still ${waiting === 1 ? 'needs' : 'need'} you.`, leftOutNote(plan) && `${leftOutNote(plan)}.`].filter(Boolean).join(' ');
  return { kind: resolved === total ? 'success' : 'info', title, ...(detail && { detail }) };
}

/** "Resolve 5 conflicts in FakeMerge". */
export function runLabel(plan: RunPlan): string {
  return `Resolve ${pluralize(plan.keys.length, 'conflict')} in ${plan.tool.name}`;
}

/** " in VS Code", " with Smart Merge", or ": 2 with Smart Merge, 1 in VS Code". */
function resolvedBy({ resolved, withSmartMerge }: RunEnding, tool: string): string {
  if (withSmartMerge === 0) return ` in ${tool}`;
  if (withSmartMerge === resolved) return ` with ${SMART_MERGE_NAME}`;
  return `: ${withSmartMerge} with ${SMART_MERGE_NAME}, ${resolved - withSmartMerge} in ${tool}`;
}

function allOf(total: number): string {
  if (total === 1) return 'the conflict';
  return total === 2 ? 'both conflicts' : `all ${total} conflicts`;
}
