import type { FileContent } from '@shared/domain/content';
import type { OpenTool } from '../mergeTools/resolveInMergeTool';
import { initialDecision, remainingConflicts, resolutionOf, type FileConflictDecision } from './fileConflictDecision';
import { loadConflict, type LoadedConflict } from './loadedConflict';
import type { ConflictLabels } from './threeWayMerge';
import type { ConflictedFile, FileConflictState } from './useFileConflicts';

/** A conflicting file with its versions (base, source, destination) as far as they've loaded, and what the user did. */
export interface ConflictFileInputs {
  file: ConflictedFile;
  versions: readonly { data?: FileContent; error: Error | null }[];
  /** The user's decision, if any. */
  decision: FileConflictDecision | undefined;
  openTool: OpenTool | undefined;
}

interface StateInputs {
  file: ConflictedFile;
  loaded: LoadedConflict;
  decision: FileConflictDecision | undefined;
  openTool: OpenTool | undefined;
}

/** The states built last time, by file key, with what each came from. */
export type BuiltStates = ReadonlyMap<string, { inputs: StateInputs; state: FileConflictState }>;

/**
 * The files' states. Merging a file and counting its conflicts read its whole text, and the page renders again for
 * every file selected and every version loaded: a file keeps its merge while its versions stay (`loadConflict`), and
 * its state (the same object) while nothing else about it changes either.
 */
export function buildStates(files: ConflictFileInputs[], labels: ConflictLabels, previous: BuiltStates): { states: FileConflictState[]; built: BuiltStates } {
  const built = new Map<string, { inputs: StateInputs; state: FileConflictState }>();
  const states = files.map(({ file, versions, decision, openTool }) => {
    const before = previous.get(file.key);
    const inputs = { file, loaded: loadConflict(versions, labels, before?.inputs.loaded), decision, openTool };
    const state = before && sameInputs(before.inputs, inputs) ? before.state : toState(inputs);
    built.set(file.key, { inputs, state });
    return state;
  });
  return { states, built };
}

function sameInputs(a: StateInputs, b: StateInputs): boolean {
  return a.file === b.file && a.loaded === b.loaded && a.decision === b.decision && a.openTool === b.openTool;
}

function toState({ file, loaded, decision: userDecision, openTool }: StateInputs): FileConflictState {
  const waiting = { file, isBinary: false, decidedByUser: false, resolution: null, mergedAutomatically: false, remainingConflicts: 0 };
  if (loaded.status === 'loading') return { ...waiting, status: 'loading' };
  if (loaded.status === 'error') return { ...waiting, status: 'error', error: loaded.error };

  const decision = userDecision ?? initialDecision(loaded.document);
  return {
    file,
    status: 'ready',
    contents: loaded.contents,
    isBinary: !loaded.document,
    document: loaded.document,
    decision,
    decidedByUser: Boolean(userDecision),
    resolution: openTool ? null : resolutionOf(decision),
    mergedAutomatically: !userDecision && loaded.document?.conflictCount === 0,
    remainingConflicts: remainingConflicts(decision),
    ...(openTool && { openTool }),
  };
}
