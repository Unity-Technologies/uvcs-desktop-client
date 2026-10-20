import { api } from '../../../api/client';

/**
 * The sessions the user stopped (Stop, Skip, Stop waiting, leaving the page), remembered here too: a stop that reaches
 * main just after Smart Merge ended there finds nothing to stop, and the tool must not open after it anyway. Ids are
 * forgotten once read (`wasStopped`).
 */
const stopped = new Set<string>();

/** Stops a merge tool or Smart Merge session: in main, and for `resolveInMergeTool`, which asks `wasStopped`. */
export function stopMergeToolSession(sessionId: string): Promise<void> {
  stopped.add(sessionId);
  return api.mergeTools.stopWaiting(sessionId);
}

/** Whether the user stopped the session, forgetting it: each session is asked once, when it ends. */
export function wasStopped(sessionId: string): boolean {
  return stopped.delete(sessionId);
}
