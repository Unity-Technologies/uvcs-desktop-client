import type { MergeToolOutcome } from '@shared/domain/mergeTools';
import { fileNameOf } from '../../../lib/text';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { toolOutcomeMessage, type OutcomeMessage } from './mergeToolOutcome';
import { runSummary, type RunPlan, type RunProgress } from './resolveRun';

/** A run under way, as the page steers it: stopped by the user, or paused on a file closed unsaved. */
export interface RunControl {
  stopped: boolean;
  /** While paused on a file closed unsaved: settles with whether to go on. */
  answer?: (goOn: boolean) => void;
}

/** What a run asks of the page around it (`useResolveRun`). */
export interface RunSteps {
  /** Whether the file still waits for the tool: files decided in the app meanwhile don't. */
  stillWaits: (key: string) => boolean;
  /** Where the run stands, for its strip. */
  show: (progress: RunProgress) => void;
  /** The file opens in the tool: `previousKey` is the one before it, if any, to follow the run with the selection. */
  open: (key: string, previousKey: string | undefined) => void;
  /** Opens the file in the tool and waits for it to close; null when it couldn't be opened here (the page went away). */
  resolve: (key: string) => Promise<MergeToolOutcome | null>;
  /** Whether a file closed unsaved asks before the next one (the setting), rather than going on. */
  asksWhenClosedUnsaved: () => boolean;
}

/** How a run ended: stopped by the user, or by a tool that couldn't open a file. */
export interface RunEnd {
  stopped: boolean;
  failure?: { outcome: MergeToolOutcome; key: string };
}

/**
 * Goes through the plan's files one after the other: the next opens once the one before is closed. Files decided
 * meanwhile are skipped; a file closed unsaved (not skipped from the app) pauses the run until the user goes on or
 * stops, unless the setting says to go on or no file after it still waits; a tool that fails to open stops the run.
 */
export async function resolveOneByOne(plan: RunPlan, run: RunControl, steps: RunSteps): Promise<RunEnd> {
  const total = plan.keys.length;
  let previousKey: string | undefined;
  for (const [position, key] of plan.keys.entries()) {
    if (run.stopped) break;
    if (!steps.stillWaits(key)) continue;
    const progress: RunProgress = { toolName: plan.tool.name, total, position, currentKey: key, paused: false };
    steps.show(progress);
    steps.open(key, previousKey);
    previousKey = key;

    const outcome = await steps.resolve(key);
    if (run.stopped || !outcome) break;
    if (outcome.kind === 'failed') return { stopped: run.stopped, failure: { outcome, key } };
    // Closed by the user without saving (not skipped from here): maybe they meant to stop, so ask before the next.
    const closedUnsaved = outcome.kind === 'unchanged' && outcome.exitCode !== null;
    if (closedUnsaved && steps.asksWhenClosedUnsaved() && plan.keys.slice(position + 1).some(steps.stillWaits)) {
      steps.show({ ...progress, paused: true });
      const goOn = await new Promise<boolean>((resolve) => (run.answer = resolve));
      run.answer = undefined;
      if (!goOn) break;
    }
  }
  return { stopped: run.stopped };
}

/** Stops the run: the file open now is the last, and a pause ends. */
export function stopRun(run: RunControl): void {
  run.stopped = true;
  run.answer?.(false);
}

/**
 * The toast once the run ended, counted from the files' states once the last decision shows in them: why it stopped
 * when a tool couldn't open a file, else how many it resolved (`runSummary`).
 */
export function runEndMessage(plan: RunPlan, end: RunEnd, states: readonly FileConflictState[]): OutcomeMessage {
  const stateOf = (key: string): FileConflictState | undefined => states.find((state) => state.file.key === key);
  if (end.failure) {
    const { outcome, key } = end.failure;
    const message = toolOutcomeMessage(outcome, plan.tool.name, fileNameOf(stateOf(key)?.file.path ?? key));
    const reason = message.detail && !/[.!?]$/.test(message.detail) ? `${message.detail}.` : message.detail;
    return { kind: 'error', title: message.title, detail: [reason, 'Stopped resolving one by one.'].filter(Boolean).join(' ') };
  }
  const resolved = plan.keys.filter((key) => stateOf(key)?.resolution).length;
  return runSummary({ resolved, total: plan.keys.length, stopped: end.stopped }, plan);
}
