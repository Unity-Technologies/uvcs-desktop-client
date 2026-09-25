import { useQueries } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import type { ContentSource, FileContent } from '@shared/domain/content';
import type { FileConflictResolution } from '@shared/domain/merge';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { initialDecision, remainingConflicts, resolutionOf, type FileConflictDecision } from './fileConflictDecision';
import { buildConflictDocument, type ConflictDocument, type ConflictLabels } from './threeWayMerge';

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
}

type LoadedFile = { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; contents: ConflictContents; document?: ConflictDocument };

/**
 * Loads the three versions of every conflicting file, merges them automatically where possible
 * and keeps the user's decisions for the rest.
 */
export function useFileConflicts(workspacePath: string, files: ConflictedFile[], labels: ConflictLabels) {
  const [decisions, setDecisions] = useState<Record<string, FileConflictDecision>>({});
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

  const states = files.map((file, index) => toState(file, loadedFiles[index]!, decisions[file.key]));

  const decide = useCallback((key: string, decision: FileConflictDecision) => {
    setDecisions((current) => ({ ...current, [key]: decision }));
  }, []);

  const reset = useCallback((key: string) => {
    setDecisions(({ [key]: _discarded, ...rest }) => rest);
  }, []);

  return { states, decide, reset };
}

function loadFile(versions: { data?: FileContent; error: Error | null }[], labels: ConflictLabels): LoadedFile {
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

function toState(file: ConflictedFile, loaded: LoadedFile, userDecision: FileConflictDecision | undefined): FileConflictState {
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
    resolution: resolutionOf(decision),
    mergedAutomatically: !userDecision && loaded.document?.conflictCount === 0,
    remainingConflicts: remainingConflicts(decision),
  };
}
