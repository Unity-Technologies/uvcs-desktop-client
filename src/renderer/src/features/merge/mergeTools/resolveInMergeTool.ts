import type { MergeTool, MergeToolOutcome } from '@shared/domain/mergeTools';
import { api } from '../../../api/client';
import { toast } from '../../../ui/toast/toastStore';
import type { MergeLabels } from '../mergeDescription';
import type { FileConflictDecision } from '../resolve/fileConflictDecision';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { decisionFromTool, toolOutcomeMessage, toolVersionNames } from './mergeToolOutcome';

/** A merge tool that has a file open, waiting for the user. */
export interface OpenTool {
  sessionId: string;
  toolName: string;
  canBringToFront: boolean;
}

/** How a merge tool session ended, and the decision it makes: what the user saved, if anything. */
export interface MergeToolSession {
  outcome: MergeToolOutcome;
  decision: FileConflictDecision | undefined;
}

/**
 * Opens one conflicting file in a merge tool and waits for it: `onOpen` reports it open, then closed (null). The
 * result file starts as the file stands in the app (the automatic merge with its markers, or the user's picks), so the
 * tool shows where things are. Tells the user how it went, unless `quiet` (resolving one by one tells it as a whole).
 */
export async function resolveInMergeTool(
  workspacePath: string,
  state: FileConflictState,
  tool: MergeTool,
  labels: MergeLabels,
  onOpen: (open: OpenTool | null) => void,
  quiet = false,
): Promise<MergeToolSession> {
  const sessionId = crypto.randomUUID();
  const fileName = state.file.path.split('/').pop()!;
  onOpen({ sessionId, toolName: tool.name, canBringToFront: tool.canBringToFront });
  let outcome: MergeToolOutcome;
  try {
    outcome = await api.mergeTools.resolve(workspacePath, {
      sessionId,
      toolId: tool.id,
      path: state.file.path,
      base: state.file.base,
      yours: state.file.destination,
      incoming: state.file.source,
      startText: startText(state),
      names: toolVersionNames(labels),
    });
  } catch (error) {
    outcome = { kind: 'failed', message: error instanceof Error ? error.message : String(error) };
  } finally {
    onOpen(null);
  }

  if (!quiet) {
    const message = toolOutcomeMessage(outcome, tool.name, fileName);
    if (message.kind === 'error') toast.error(message.title, message.detail);
    else toast[message.kind](message.title, message.detail);
  }
  return { outcome, decision: decisionFromTool(outcome, tool.name) };
}

function startText(state: FileConflictState): string {
  return state.decision?.kind === 'text' ? state.decision.text : (state.document?.text ?? '');
}
