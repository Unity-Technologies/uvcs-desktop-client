import { useQueries } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ContentSource } from '@shared/domain/content';
import type { FileConflictResolution } from '@shared/domain/merge';
import type { MergeTool, MergeToolOutcome } from '@shared/domain/mergeTools';
import { api } from '../../../api/client';
import { queryClient } from '../../../app/queryClient';
import { useSettledValue } from '../../../lib/useSettled';
import type { MergeLabels } from '../mergeDescription';
import { resolveInMergeTool, type OpenTool } from '../mergeTools/resolveInMergeTool';
import { useMergeTools } from '../mergeTools/useMergeTools';
import { conflictVersionQuery } from './conflictVersionQuery';
import { readsOnOpen, upFrontReads, versionReads, versionsOf } from './conflictVersionReads';
import type { FileConflictDecision } from './fileConflictDecision';
import { buildStates, type BuiltStates } from './fileConflictStates';
import type { ConflictContents } from './loadedConflict';
import type { ConflictDocument } from './threeWayMerge';
import { useQueriesByFrame } from './useQueriesByFrame';

/** A file changed on both sides, and where to read each version from. */
export interface ConflictedFile {
  /** Identifies the file in the resolutions sent to the main process. */
  key: string;
  /** Shown to the user and used to pick syntax highlighting. */
  path: string;
  base: ContentSource;
  source: ContentSource;
  destination: ContentSource;
  /**
   * Known to be a binary before any version is read (by the type `cm` keeps for one of its revisions): it needs a
   * decision straight away, and its versions are read only once the user opens it (`readsOnOpen`). Without it, the
   * versions read tell.
   */
  isKnownBinary?: boolean;
}

export interface FileConflictState {
  file: ConflictedFile;
  status: 'loading' | 'error' | 'ready';
  /** Why its versions couldn't be read: its status (`error`), or for a known binary, what its cards show. */
  error?: Error;
  /** Its three versions, once read: a known binary's only once it opens. */
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
 * Loads the three versions of every conflicting file but the known binaries, merges them automatically where possible
 * and keeps the user's decisions for the rest, including the ones made in a merge tool. A known binary's versions are
 * read once it opens (`openFile`: the file the page shows) and the selection settles on it (`useSettledValue`), or at
 * once when read before: holding ↓ through a folder of textures reads none of those it passes. They are kept while it
 * stays open.
 */
export function useFileConflicts(workspacePath: string, files: ConflictedFile[], labels: MergeLabels) {
  const [decisions, setDecisions] = useState<Record<string, FileConflictDecision>>({});
  const [openTools, setOpenTools] = useState<Record<string, OpenTool>>({});
  const [openKey, openFile] = useState<string>();
  // Kept while the files are: three queries a file, which TanStack hashes and subscribes to again whenever they're new.
  // Their results come at most once a frame: thousands of versions answer one after the other.
  const upFront = useMemo(() => upFrontReads(files), [files]);
  const contentQueries = useMemo(() => upFront.sources.map((source) => conflictVersionQuery(workspacePath, source)), [workspacePath, upFront]);
  const upFrontResults = useQueriesByFrame(contentQueries);
  const openedFile = files.find((file) => file.key === openKey);
  const settled = useSettledValue(openKey, openKey ?? '') === openKey;
  const openedVersions = useQueries({
    queries: readsOnOpen(openedFile).map((source) => {
      const query = conflictVersionQuery(workspacePath, source);
      return { ...query, enabled: settled || queryClient.getQueryData(query.queryKey) !== undefined };
    }),
    combine: versionReads,
  });
  const built = useRef<BuiltStates>(new Map());
  const states = useMemo(() => {
    const opened = openedFile && { key: openedFile.key, versions: openedVersions };
    const next = buildStates(
      files.map((file) => ({ file, versions: versionsOf(file, upFront, upFrontResults, opened), decision: decisions[file.key], openTool: openTools[file.key] })),
      labels,
      built.current,
    );
    built.current = next.built;
    return next.states;
  }, [files, labels, upFront, upFrontResults, openedFile, openedVersions, decisions, openTools]);
  const latest = useRef({ states, openTools });
  latest.current = { states, openTools };

  const decide = useCallback((key: string, decision: FileConflictDecision) => {
    setDecisions((current) => ({ ...current, [key]: decision }));
  }, []);

  const hasSmartMerge = useMergeTools().smartMerge !== null;

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
        {
          quiet,
          smartMerge: hasSmartMerge,
          stillUndecided: () => !latest.current.states.find((candidate) => candidate.file.key === key)?.decidedByUser,
        },
      );
      if (decision) decide(key, decision);
      return outcome;
    },
    [workspacePath, labels, decide, hasSmartMerge],
  );

  // Leaving the merge stops waiting for the tools still open: what they save afterwards has nowhere to go.
  useEffect(() => () => Object.values(latest.current.openTools).forEach((open) => void api.mergeTools.stopWaiting(open.sessionId)), []);

  return { states, decide, reset, resolveInTool, openFile };
}
