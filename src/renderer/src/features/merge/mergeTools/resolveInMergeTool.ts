import { SMART_MERGE_NAME, type MergeTool, type MergeToolOutcome, type SmartMergeOutcome, type SmartMergeRequest } from '@shared/domain/mergeTools';
import { api } from '../../../api/client';
import { fileNameOf } from '../../../lib/text';
import { toast } from '../../../ui/toast/toastStore';
import type { MergeLabels } from '../mergeDescription';
import type { FileConflictDecision } from '../resolve/fileConflictDecision';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { decisionFromTool, toolOutcomeMessage, toolVersionNames } from './mergeToolOutcome';
import { wasStopped } from './mergeToolSessions';
import { smartMergeVersions } from './smartMergeVersions';

/**
 * A merge tool that has a file open, waiting for the user; or Smart Merge merging it, with no window (`toolName` is
 * `SMART_MERGE_NAME`, and nothing can be brought to the front).
 */
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

/** How "Resolve in…" runs for one file. */
export interface ResolveOptions {
  /** Leaves telling how it went to the caller (resolving one by one tells it as a whole). */
  quiet?: boolean;
  /** Smart Merge was found (`MergeToolList.smartMerge`): without it, nothing shows it at work. */
  smartMerge: boolean;
  /** Whether the user still hasn't decided the file in the app: asked once Smart Merge is done. */
  stillUndecided: () => boolean;
}

/** What a session ends with when it decides nothing and the user already knows why (stopped, or decided meanwhile). */
const NOTHING_SAVED: MergeToolOutcome = { kind: 'unchanged', exitCode: null, errorOutput: '' };

/**
 * Opens one conflicting file in a merge tool and waits for it: `onOpen` reports it open, then closed (null). The
 * result file starts as the file stands in the app (the automatic merge with its markers, or the user's picks), so the
 * tool shows where things are. A Unity asset the user decided nothing for goes to Smart Merge first
 * (`smartMergeVersions`), reported open as Smart Merge while it merges: the tool opens only if it doesn't merge the
 * file, and not at all if the user stopped it. A decision the user made in the app meanwhile stands: Smart Merge's
 * merge is dropped and nothing opens.
 */
export async function resolveInMergeTool(
  workspacePath: string,
  state: FileConflictState,
  tool: MergeTool,
  labels: MergeLabels,
  onOpen: (open: OpenTool | null) => void,
  options: ResolveOptions,
): Promise<MergeToolSession> {
  const versions = options.smartMerge ? smartMergeVersions(state) : null;
  if (versions) {
    const smartMerged = await runSmartMerge(versions, onOpen);
    if (!options.stillUndecided()) return { outcome: NOTHING_SAVED, decision: undefined };
    if (smartMerged) return ended(smartMerged, SMART_MERGE_NAME, state, options);
  }
  return ended(await openInTool(workspacePath, state, tool, labels, onOpen), tool.name, state, options);
}

/** The session's decision, `by` the tool or Smart Merge, told to the user unless `quiet`. */
function ended(outcome: MergeToolOutcome, by: string, state: FileConflictState, { quiet }: ResolveOptions): MergeToolSession {
  if (!quiet) {
    const message = toolOutcomeMessage(outcome, by, fileNameOf(state.file.path));
    if (message.kind === 'error') toast.error(message.title, message.detail);
    else toast[message.kind](message.title, message.detail);
  }
  return { outcome, decision: decisionFromTool(outcome, by) };
}

/** Smart Merge's outcome when it merged the file or the user stopped it; null when the tool is to open. */
async function runSmartMerge(versions: Omit<SmartMergeRequest, 'sessionId'>, onOpen: (open: OpenTool | null) => void): Promise<MergeToolOutcome | null> {
  const sessionId = crypto.randomUUID();
  onOpen({ sessionId, toolName: SMART_MERGE_NAME, canBringToFront: false });
  try {
    const merged = await api.mergeTools.smartMerge({ sessionId, ...versions }).catch((): SmartMergeOutcome => ({ kind: 'notMerged' }));
    // Stopped here too late for main to stop it: still stopped, so no tool opens after the user said stop.
    if (wasStopped(sessionId) || merged.kind === 'stopped') return NOTHING_SAVED;
    return merged.kind === 'merged' ? { kind: 'resolved', text: merged.text } : null;
  } finally {
    onOpen(null);
  }
}

async function openInTool(workspacePath: string, state: FileConflictState, tool: MergeTool, labels: MergeLabels, onOpen: (open: OpenTool | null) => void): Promise<MergeToolOutcome> {
  const sessionId = crypto.randomUUID();
  onOpen({ sessionId, toolName: tool.name, canBringToFront: tool.canBringToFront });
  try {
    return await api.mergeTools.resolve(workspacePath, {
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
    return { kind: 'failed', message: error instanceof Error ? error.message : String(error) };
  } finally {
    onOpen(null);
    wasStopped(sessionId); // Main had the tool to stop: only forgotten here.
  }
}

function startText(state: FileConflictState): string {
  return state.decision?.kind === 'text' ? state.decision.text : (state.document?.text ?? '');
}
