import type { FileContent } from '@shared/domain/content';
import { buildConflictDocument, type ConflictDocument, type ConflictLabels } from './threeWayMerge';

export interface ConflictContents {
  base: FileContent;
  source: FileContent;
  destination: FileContent;
}

/** A conflicting file as far as its three versions have loaded, merged automatically once they all have. */
export type LoadedConflict =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; contents: ConflictContents; labels: ConflictLabels; document?: ConflictDocument };

/**
 * The file from its versions (base, source, destination). Merging is the expensive part, and the versions of hundreds
 * of files load one after the other: a file whose versions and labels are the ones `previous` merged keeps that merge.
 */
export function loadConflict(
  versions: readonly { data?: FileContent; error: Error | null }[],
  labels: ConflictLabels,
  previous?: LoadedConflict,
): LoadedConflict {
  const error = versions.find((version) => version.error)?.error;
  if (error) return { status: 'error', error };

  const [base, source, destination] = versions.map((version) => version.data);
  if (!base || !source || !destination) return { status: 'loading' };

  if (previous?.status === 'ready' && previous.labels === labels) {
    const { contents } = previous;
    if (contents.base === base && contents.source === source && contents.destination === destination) return previous;
  }

  const isBinary = base.isBinary || source.isBinary || destination.isBinary;
  return {
    status: 'ready',
    contents: { base, source, destination },
    labels,
    document: isBinary ? undefined : buildConflictDocument(base.text ?? '', source.text ?? '', destination.text ?? '', labels),
  };
}
