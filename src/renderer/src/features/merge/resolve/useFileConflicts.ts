import { useQueries } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ContentSource } from '@shared/domain/content';
import type { FileConflictResolution } from '@shared/domain/merge';
import type { MergeTool, MergeToolOutcome } from '@shared/domain/mergeTools';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import type { MergeLabels } from '../mergeDescription';
import { resolveInMergeTool, type OpenTool } from '../mergeTools/resolveInMergeTool';
import type { FileConflictDecision } from './fileConflictDecision';
import { buildStates, type BuiltStates } from './fileConflictStates';
import type { ConflictContents } from './loadedConflict';
import type { ConflictDocument } from './threeWayMerge';

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

/**
 * Loads the three versions of every conflicting file, merges them automatically where possible
 * and keeps the user's decisions for the rest, including the ones made in a merge tool.
 */
export function useFileConflicts(workspacePath: string, files: ConflictedFile[], labels: MergeLabels) {
  const [decisions, setDecisions] = useState<Record<string, FileConflictDecision>>({});
  const [openTools, setOpenTools] = useState<Record<string, OpenTool>>({});
  // Kept while the files are: three queries a file, which TanStack hashes and subscribes to again whenever they're new.
  const contentQueries = useMemo(
    () =>
      files
        .flatMap((file) => [file.base, file.source, file.destination])
        .map((source) => ({
          queryKey: queryKeys.inWorkspace(workspacePath, 'content', source),
          queryFn: () => api.content.read(workspacePath, source),
          staleTime: Infinity,
        })),
    [workspacePath, files],
  );
  const queries = useQueries({ queries: contentQueries });

  // `queries` is a new array on every render, so `loadedVersion` stands for it in the dependencies.
  const loadedVersion = queries.map((query) => `${query.status}:${query.dataUpdatedAt}`).join('|');
  const built = useRef<BuiltStates>(new Map());
  const states = useMemo(() => {
    const next = buildStates(
      files.map((file, index) => ({ file, versions: queries.slice(index * 3, index * 3 + 3), decision: decisions[file.key], openTool: openTools[file.key] })),
      labels,
      built.current,
    );
    built.current = next.built;
    return next.states;
  }, [files, labels, loadedVersion, decisions, openTools]);
  const latest = useRef({ states, openTools });
  latest.current = { states, openTools };

  const decide = useCallback((key: string, decision: FileConflictDecision) => {
    setDecisions((current) => ({ ...current, [key]: decision }));
  }, []);

  const reset = useCallback((key: string) => {
    setDecisions(({ [key]: _discarded, ...rest }) => rest);
  }, []);

  /**
   * Opens the file in the tool; its decision follows what the user saves there. Null when it can't open (the file
   * isn't there or is open already); `quiet` leaves telling how it went to the caller.
   */
  const resolveInTool = useCallback(
    async (key: string, tool: MergeTool, quiet = false): Promise<MergeToolOutcome | null> => {
      const state = latest.current.states.find((candidate) => candidate.file.key === key);
      if (!state || latest.current.openTools[key]) return null;
      const { outcome, decision } = await resolveInMergeTool(
        workspacePath,
        state,
        tool,
        labels,
        (open) => setOpenTools(({ [key]: _closed, ...others }) => (open ? { ...others, [key]: open } : others)),
        quiet,
      );
      if (decision) decide(key, decision);
      return outcome;
    },
    [workspacePath, labels, decide],
  );

  // Leaving the merge stops waiting for the tools still open: what they save afterwards has nowhere to go.
  useEffect(() => () => Object.values(latest.current.openTools).forEach((open) => void api.mergeTools.stopWaiting(open.sessionId)), []);

  return { states, decide, reset, resolveInTool };
}
