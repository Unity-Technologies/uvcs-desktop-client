import type { MergeToolOutcome } from '@shared/domain/mergeTools';
import { pluralize } from '../../../lib/text';
import type { MergeLabels } from '../mergeDescription';
import type { FileConflictDecision } from '../resolve/fileConflictDecision';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { countConflictRegions } from '../resolve/threeWayMerge';

/**
 * Whether a file waits for the user and a merge tool can open it: "Resolve all in…" goes through these. Text files
 * only: a binary keeps one of its versions, picked in the app.
 */
export function waitsForTool(state: FileConflictState): boolean {
  return state.status === 'ready' && !state.resolution && !state.openTool && !state.isBinary;
}

/** The decision a merge tool's outcome makes; none when nothing was saved. */
export function decisionFromTool(outcome: MergeToolOutcome, tool: string): FileConflictDecision | undefined {
  if (outcome.kind === 'resolved') return { kind: 'text', text: outcome.text, tool };
  return undefined;
}

export interface OutcomeMessage {
  kind: 'success' | 'info' | 'error';
  title: string;
  detail?: string;
}

/** What to tell the user once the tool closed, in the merge page's words. */
export function toolOutcomeMessage(outcome: MergeToolOutcome, tool: string, fileName: string): OutcomeMessage {
  switch (outcome.kind) {
    case 'resolved': {
      const left = countConflictRegions(outcome.text);
      if (left > 0) {
        return {
          kind: 'info',
          title: `${fileName} still has ${pluralize(left, 'conflict')}`,
          detail: `${tool} saved it with conflict markers left.`,
        };
      }
      return { kind: 'success', title: `Resolved ${fileName} in ${tool}` };
    }
    case 'unchanged':
      if (outcome.exitCode === null) return { kind: 'info', title: `Stopped waiting for ${tool}`, detail: `Nothing was saved, so ${fileName} still needs your decision.` };
      return {
        kind: 'info',
        title: `${tool} closed without saving ${fileName}`,
        detail: [`It still needs your decision.`, outcome.exitCode !== 0 && lastLine(outcome.errorOutput)].filter(Boolean).join(' '),
      };
    case 'failed':
      return { kind: 'error', title: `Couldn't open ${fileName} in ${tool}`, detail: outcome.message };
  }
}

/** How each version is called in the tool's window: `Yours (/main/task)`, `Incoming (/main)`. */
export function toolVersionNames(labels: MergeLabels): { base: string; yours: string; incoming: string } {
  return {
    base: 'Base',
    yours: `${labels.roles.destination.name} (${labels.destination})`,
    incoming: `${labels.roles.source.name} (${labels.source})`,
  };
}

function lastLine(text: string): string {
  return text.split('\n').filter((line) => line.trim()).at(-1)?.trim() ?? '';
}
