import { useQueries } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ContentSource, FileContent } from '@shared/domain/content';
import type { FileConflictResolution } from '@shared/domain/merge';
import type { MergeTool } from '@shared/domain/mergeTools';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import type { MergeLabels } from '../mergeDescription';
import { waitsForTool } from '../mergeTools/mergeToolOutcome';
import { resolveInMergeTool, type OpenTool } from '../mergeTools/resolveInMergeTool';
import { initialDecision, remainingConflicts, resolutionOf, type FileConflictDecision } from './fileConflictDecision';
import { buildConflictDocument, type ConflictDocument } from './threeWayMerge';

/** A file changed on both sides, and where to read each version from. */
export interface ConflictedFile {
  /** Identifies the file in the resolutions sent to the main process. */
  key: string;
  /** Shown to the user and used to pick syntax highlighting. */
  path: string;
  base: ContentSource;
  source: ContentSource;
  destination: ContentSource;
}

export interface ConflictContents {
  base: FileContent;
  source: FileContent;
  destination: FileContent;
}

export interface FileConflictState {
  file: ConflictedFile;
  status: 'loading' | 'error' | 'ready';
  error?: Error;
  contents?: ConflictContents;
  isBinary: boolean;
  /** The automatic three-way merge, for text files. */
  document?: ConflictDocument;
  decision?: FileConflictDecision;
  /** The decision is the user's, not the one the file started with. */
  decidedByUser: boolean;
  resolution: FileConflictResolution | null;
  /** Merged with no conflicting regions and not touched by the user. */
  mergedAutomatically: boolean;
  remainingConflicts: number;
  /** The merge tool the file is open in; it has no resolution meanwhile. */
  openTool?: OpenTool;
}

type LoadedFile = { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; contents: ConflictContents; document?: ConflictDocument };

/**
 * Loads the three versions of every conflicting file, merges them automatically where possible
 * and keeps the user's decisions for the rest, including the ones made in a merge tool.
 */
export function useFileConflicts(workspacePath: string, files: ConflictedFile[], labels: MergeLabels) {
  const [decisions, setDecisions] = useState<Record<string, FileConflictDecision>>({});
  const [openTools, setOpenTools] = useState<Record<string, OpenTool>>({});
  const queries = useQueries({
    queries: files
      .flatMap((file) => [file.base, file.source, file.destination])
      .map((source) => ({
        queryKey: queryKeys.inWorkspace(workspacePath, 'content', source),
        queryFn: () => api.content.read(workspacePath, source),
        staleTime: Infinity,
      })),
  });

  // Merging is the expensive part: only redo it when some content finishes loading.
  // `queries` is a new array on every render, so `loadedVersion` stands for it in the dependencies.
  const loadedVersion = queries.map((query) => `${query.status}:${query.dataUpdatedAt}`).join('|');
  const loadedFiles = useMemo(
    () => files.map((_, index) => loadFile(queries.slice(index * 3, index * 3 + 3), labels)),
    [files, labels, loadedVersion],
  );

  const states = files.map((file, index) => toState(file, loadedFiles[index]!, decisions[file.key], openTools[file.key]));
  const latest = useRef({ states, openTools });
  latest.current = { states, openTools };

  const decide = useCallback((key: string, decision: FileConflictDecision) => {
    setDecisions((current) => ({ ...current, [key]: decision }));
  }, []);

  const reset = useCallback((key: string) => {
    setDecisions(({ [key]: _discarded, ...rest }) => rest);
  }, []);

  /** Opens the file in the tool; its decision follows what the user saves there. False if they didn't save. */
  const resolveInTool = useCallback(
    async (key: string, tool: MergeTool): Promise<boolean> => {
      const state = latest.current.states.find((candidate) => candidate.file.key === key);
      if (!state || latest.current.openTools[key]) return false;
      const decision = await resolveInMergeTool(workspacePath, state, tool, labels, (open) =>
        setOpenTools(({ [key]: _closed, ...others }) => (open ? { ...others, [key]: open } : others)),
      );
      if (decision) decide(key, decision);
      return Boolean(decision);
    },
    [workspacePath, labels, decide],
  );

  /** Every file still waiting for the user, one after the other, until one closes without saving. */
  const resolveAllInTool = useCallback(
    async (tool: MergeTool): Promise<void> => {
      const keys = latest.current.states.filter((state) => waitsForTool(state, tool)).map((state) => state.file.key);
      for (const key of keys) {
        const state = latest.current.states.find((candidate) => candidate.file.key === key);
        if (!state || !waitsForTool(state, tool)) continue;
        if (!(await resolveInTool(key, tool))) return;
      }
    },
    [resolveInTool],
  );

  // Leaving the merge stops waiting for the tools still open: what they save afterwards has nowhere to go.
  useEffect(() => () => Object.values(latest.current.openTools).forEach((open) => void api.mergeTools.stopWaiting(open.sessionId)), []);

  return { states, decide, reset, resolveInTool, resolveAllInTool };
}

function loadFile(versions: { data?: FileContent; error: Error | null }[], labels: MergeLabels): LoadedFile {
  const error = versions.find((version) => version.error)?.error;
  if (error) return { status: 'error', error };

  const [base, source, destination] = versions.map((version) => version.data);
  if (!base || !source || !destination) return { status: 'loading' };

  const isBinary = base.isBinary || source.isBinary || destination.isBinary;
  return {
    status: 'ready',
    contents: { base, source, destination },
    document: isBinary ? undefined : buildConflictDocument(base.text ?? '', source.text ?? '', destination.text ?? '', labels),
  };
}

function toState(file: ConflictedFile, loaded: LoadedFile, userDecision: FileConflictDecision | undefined, openTool: OpenTool | undefined): FileConflictState {
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
