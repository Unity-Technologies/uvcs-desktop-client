import type { ContentSource } from './content';

/**
 * A three-way merge app the user can resolve a conflicting file in: the UVCS merge tool, a well-known one found on the
 * machine, or one the user added. It opens only when the user asks, on one file.
 */
export interface MergeTool {
  /** `uvcs`, `vscode`, `kdiff3`... for known tools; `custom:<n>` for the user's. */
  id: string;
  name: string;
  origin: 'known' | 'custom';
  /** The program run, found on this machine (or picked by the user). */
  executable: string;
  /**
   * Its arguments for text files, one per element, with `{base}`, `{yours}`, `{incoming}`, `{result}` and
   * `{baseName}`, `{yoursName}`, `{incomingName}`, `{fileName}` replaced for each file. The user's override if any.
   */
  args: string[];
  /** The arguments before the user's override, to offer going back to them. */
  defaultArgs: string[];
  /** Its window can be brought forward while it's open (an app bundle on macOS). */
  canBringToFront: boolean;
}

/** The tools found, with the one "Resolve in…" uses: the user's choice, or else the UVCS tool, or else the first. */
export interface MergeToolList {
  tools: MergeTool[];
  preferredId: string | null;
}

/** A merge app added by the user; known tools are found, not stored. */
export interface CustomMergeTool {
  id: string;
  name: string;
  executable: string;
  args: string[];
}

/** `auto`: the UVCS merge tool when it's installed, otherwise the first tool found. */
export const AUTO_MERGE_TOOL = 'auto';

export interface MergeToolRequest {
  /** Chosen by the caller, to cancel it or bring its window forward while it's open. */
  sessionId: string;
  toolId: string;
  /** The file's workspace path, for its name and extension. */
  path: string;
  base: ContentSource;
  yours: ContentSource;
  incoming: ContentSource;
  /**
   * What the result file holds when the tool opens (the automatic merge with its conflict markers, or what the user
   * decided so far). A result left like this means nothing was resolved.
   */
  startText: string;
  /** How each version is called in the tool's window, e.g. `Yours (/main/task)`. */
  names: { base: string; yours: string; incoming: string };
}

/**
 * How it ended, judged by the result file (few tools tell saving from cancelling by their exit code): what the user
 * saved; `unchanged` when the tool closed without saving, or the user stopped waiting; `failed` when it couldn't run.
 */
export type MergeToolOutcome =
  /** A text file saved: its merged text, conflict markers included if the user left some. */
  | { kind: 'resolved'; text: string }
  /** `exitCode` is null when the user stopped waiting; `errorOutput` is the end of what the tool wrote to stderr. */
  | { kind: 'unchanged'; exitCode: number | null; errorOutput: string }
  | { kind: 'failed'; message: string };
