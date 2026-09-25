import { canMergeIn, type MergeTool, type MergeToolOutcome } from '@shared/domain/mergeTools';
import { pluralize } from '../../../lib/text';
import type { MergeLabels } from '../mergeDescription';
import type { FileConflictDecision } from '../resolve/fileConflictDecision';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { countConflictRegions } from '../resolve/threeWayMerge';

/** Whether a file waits for the user and the tool can open it: "Resolve all in…" goes through these. */
export function waitsForTool(state: FileConflictState, tool: MergeTool): boolean {
  if (state.status !== 'ready' || state.resolution || state.openTool) return false;
  return canMergeIn(tool, state.file.path, state.isBinary);
}

/** The decision a merge tool's outcome makes; none when nothing was saved. */
export function decisionFromTool(outcome: MergeToolOutcome, tool: string): FileConflictDecision | undefined {
  if (outcome.kind === 'resolved') return { kind: 'text', text: outcome.text, tool };
  if (outcome.kind === 'keptSide') return { kind: 'wholeFile', side: outcome.side, tool };
  return undefined;
}

export interface OutcomeMessage {
  kind: 'success' | 'info' | 'error';
  title: string;
  detail?: string;
}

/** What to tell the user once the tool closed, in the merge page's words: nothing is written until the merge completes. */
export function toolOutcomeMessage(outcome: MergeToolOutcome, tool: string, fileName: string, labels: MergeLabels): OutcomeMessage {
  switch (outcome.kind) {
    case 'resolved': {
      const left = countConflictRegions(outcome.text);
      if (left > 0) {
        return {
          kind: 'info',
          title: `${fileName} still has ${pluralize(left, 'conflict')}`,
          detail: `${tool} saved it with conflict markers left. Pick a side for each, or open it in ${tool} again.`,
        };
      }
      return { kind: 'success', title: `Resolved ${fileName} in ${tool}`, detail: 'It will be written as you saved it when you complete the merge.' };
    }
    case 'keptSide': {
      const role = outcome.side === 'source' ? labels.roles.source : labels.roles.destination;
      return { kind: 'success', title: `Resolved ${fileName} in ${tool}`, detail: `Keeping ${role.version}.` };
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
