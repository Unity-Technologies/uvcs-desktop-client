import type { MergeToolList, MergeToolOutcome, MergeToolRequest, SmartMergeOutcome, SmartMergeRequest } from '../domain/mergeTools';

/** Merge apps to resolve a conflicting file in, opened only when the user asks. */
export interface MergeToolsApi {
  /** The tools installed here (looked for on each call) and the user's, and the one to offer first. */
  list(): Promise<MergeToolList>;
  /**
   * Opens one file's versions in the tool and waits until it closes, or the user stops waiting. The workspace is left
   * alone: the outcome is a decision for the merge, written when the merge completes.
   */
  resolve(workspacePath: string, request: MergeToolRequest): Promise<MergeToolOutcome>;
  /**
   * Merges a Unity asset with Smart Merge, without a window, before any tool opens on it: the merged text only when it
   * merged every change. Nothing is read from `cm`: the request holds the versions.
   */
  smartMerge(request: SmartMergeRequest): Promise<SmartMergeOutcome>;
  /**
   * Stops waiting for the tool (closing it where it can), or stops Smart Merge; `resolve` then returns with what the
   * tool saved so far, if anything, and `smartMerge` with `stopped`.
   */
  stopWaiting(sessionId: string): Promise<void>;
  bringToFront(sessionId: string): Promise<void>;
  /** Asks for a program (or macOS app) to add as a merge tool; the program to run, or null if cancelled. */
  pickProgram(): Promise<string | null>;
}
