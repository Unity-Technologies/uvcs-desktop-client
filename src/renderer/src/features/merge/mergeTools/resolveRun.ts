import { UNITY_YAML_MERGE_NAME, type MergeTool } from '@shared/domain/mergeTools';
import { mergerName, sameMerger, type Merger } from './mergeToolFor';
import { fileNameOf, listNames, pluralize } from '../../../lib/text';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { waitsForTool } from './mergeToolOutcome';
import type { ToolChoice } from './toolChoices';

/** A file of a run, and what it opens in. */
export interface RunStep {
  key: string;
  merger: Merger;
}

/** Resolving the files that wait for the user one after the other, each in a merge tool or UnityYAMLMerge. */
export interface RunPlan {
  /** The files it opens, in the list's order. */
  steps: RunStep[];
  /** Binary files waiting for the user, which no tool opens: left to them. */
  left: FileConflictState[];
  /** What was picked for this run alone ("All in <tool>"); null when each file opens in its own (`mergeToolFor`). */
  picked: Merger | null;
}

/** What a file opens in (`useFileMergers`); none when no tool was found. */
export type MergerForFile = (state: FileConflictState) => Merger | undefined;

/** What a run would go through now: each file in its own merger, or every one in the one `picked`. */
export function planRun(states: FileConflictState[], mergerFor: MergerForFile, picked: Merger | null = null): RunPlan {
  const waiting = states.filter((state) => state.status === 'ready' && !state.resolution && !state.openTool);
  const steps = waiting.filter(waitsForTool).flatMap((state) => {
    const merger = picked ?? mergerFor(state);
    return merger ? [{ key: state.file.key, merger }] : [];
  });
  return { steps, left: waiting.filter((state) => !waitsForTool(state)), picked };
}

/** Every file of the run opens in this (picked for it, or each file's own being the same); null when they differ. */
export function runMerger(plan: RunPlan): Merger | null {
  if (plan.picked) return plan.picked;
  const [first, ...others] = plan.steps;
  return first && others.every((step) => sameMerger(step.merger, first.merger)) ? first.merger : null;
}

/**
 * The runs on offer while any file waits for a tool: each file in its own merger first, then every file in one tool,
 * for each other tool. None otherwise.
 */
export function runPlans(states: FileConflictState[], tools: MergeTool[], mergerFor: MergerForFile): RunPlan[] {
  const byFile = planRun(states, mergerFor);
  if (byFile.steps.length === 0) return [];
  const same = runMerger(byFile);
  const allIn = tools
    .map((tool): Merger => ({ kind: 'tool', tool }))
    .filter((merger) => !sameMerger(merger, same ?? undefined))
    .map((merger) => planRun(states, mergerFor, merger));
  return [byFile, ...allIn];
}

/** The tool the run's files open in, UnityYAMLMerge's fallback for it; null when they differ. */
function runToolName(plan: RunPlan): string | null {
  const merger = runMerger(plan);
  if (!merger) return null;
  return merger.kind === 'tool' ? merger.tool.name : (merger.fallback?.name ?? null);
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

/** How the run strip speaks of the file at hand. */
export interface RunStripWords {
  /** What has the file: the tool open on it (UnityYAMLMerge's fallback once it opens), else the step's. */
  toolName: string;
  /** "in VS Code", or "with UnityYAMLMerge". */
  where: string;
  skipTip: string;
  stopTip: string;
  /** Esc asks before stopping: a tool closes the file the user may be working on. */
  confirmsStop: boolean;
}

/**
 * The strip's words while a tool has the file, or while UnityYAMLMerge merges it: it has no window to close and
 * nothing the user saved, so stopping it needs no confirmation.
 */
export function runStripWords(stepName: string, openToolName: string | undefined): RunStripWords {
  const toolName = openToolName ?? stepName;
  if (toolName === UNITY_YAML_MERGE_NAME) {
    return {
      toolName,
      where: `with ${UNITY_YAML_MERGE_NAME}`,
      skipTip: `Stops ${UNITY_YAML_MERGE_NAME} and goes on to the next file`,
      stopTip: `Stops ${UNITY_YAML_MERGE_NAME}; the file stays as it was`,
      confirmsStop: false,
    };
  }
  return {
    toolName,
    where: `in ${toolName}`,
    skipTip: `Closes it in ${toolName} and opens the next file`,
    stopTip: `Closes it in ${toolName}; what you saved there so far is kept`,
    confirmsStop: true,
  };
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
  const tool = runToolName(plan);
  const merger = runMerger(plan);
  const waiting = total - resolved;
  const by = resolvedBy(ending, tool);
  const title =
    resolved === total
      ? `Resolved ${allOf(total)}${by}`
      : stopped && resolved === 0
        ? `Stopped resolving ${merger ? `in ${mergerName(merger)}` : 'one by one'}`
        : `${stopped ? 'Stopped: resolved' : 'Resolved'} ${resolved} of ${total}${by}`;
  const detail = [waiting > 0 && `${waiting} still ${waiting === 1 ? 'needs' : 'need'} you.`, leftOutNote(plan) && `${leftOutNote(plan)}.`].filter(Boolean).join(' ');
  return { kind: resolved === total ? 'success' : 'info', title, ...(detail && { detail }) };
}

/** "Resolve 5 conflicts in FakeMerge", or "Resolve 5 conflicts one by one" when they open in different tools. */
export function runLabel(plan: RunPlan): string {
  const merger = runMerger(plan);
  return `Resolve ${pluralize(plan.steps.length, 'conflict')} ${merger ? `in ${mergerName(merger)}` : 'one by one'}`;
}

/** The button's tooltip: where the files open, and how to go on. */
export function runTip(plan: RunPlan): string {
  const merger = runMerger(plan);
  return `Opens each file in ${merger ? mergerName(merger) : 'its merge tool'} in turn: save and close it there to get the next`;
}

/** A run of every file in one tool, behind the button's caret: "All in Meld · 5 conflicts". */
export function allInLabel(plan: RunPlan): string {
  return `All in ${plan.picked ? mergerName(plan.picked) : ''} · ${pluralize(plan.steps.length, 'conflict')}`;
}

/** The runs behind the button's caret, every file in one tool: the plans after the first, by their tool. */
export function allInChoices(plans: readonly RunPlan[]): ToolChoice[] {
  return plans.slice(1).flatMap((plan) => (plan.picked ? [{ merger: plan.picked, label: allInLabel(plan) }] : []));
}

/**
 * " in VS Code", " with Smart Merge", or ": 2 with Smart Merge, 1 in VS Code"; with files in different tools, nothing
 * or "…, 1 in merge tools".
 */
function resolvedBy({ resolved, withSmartMerge }: RunEnding, tool: string | null): string {
  if (withSmartMerge === 0) return tool ? ` in ${tool}` : '';
  if (withSmartMerge === resolved) return ` with ${UNITY_YAML_MERGE_NAME}`;
  return `: ${withSmartMerge} with ${UNITY_YAML_MERGE_NAME}, ${resolved - withSmartMerge} in ${tool ?? 'merge tools'}`;
}

function allOf(total: number): string {
  if (total === 1) return 'the conflict';
  return total === 2 ? 'both conflicts' : `all ${total} conflicts`;
}
