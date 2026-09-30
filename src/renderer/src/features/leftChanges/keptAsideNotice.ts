import type { KeptAsideFile } from '@shared/domain/switchWithChanges';
import { api } from '../../api/client';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { REVEAL_LABEL } from '../../lib/platform';
import { fileNameOf } from '../../lib/text';
import { toast } from '../../ui/toast/toastStore';

/** Paths named in the toast; the rest are counted. */
const NAMED_PATHS = 3;

/**
 * Shelved changes came back, but files moved aside couldn't: another item is at their path now (`filesKeptAside`).
 * Nothing is lost and nothing hidden: the toast names them and reveals the (first) copy kept in the app's data folder.
 */
export function noteKeptAside(files: KeptAsideFile[]): void {
  const [first] = files;
  if (!first) return;
  const reveal = { label: REVEAL_LABEL, run: () => void api.system.revealInFileManager(first.savedAt) };
  if (files.length === 1) {
    toast.info(`Kept your copy of ${fileNameOf(first.path)}`, `Another item is at ${first.path} now, so yours is in the app's data folder.`, reveal);
    return;
  }
  toast.info(`Kept your copies of ${files.length} files`, `Other items are at ${namedPaths(files)} now, so yours are in the app's data folder.`, reveal);
}

/** "a.txt, b.txt, c.txt and 2 more". */
function namedPaths(files: KeptAsideFile[]): string {
  const named = files.slice(0, NAMED_PATHS).map((file) => file.path);
  const more = files.length - named.length;
  return more > 0 ? `${named.join(', ')} and ${more} more` : `${named.slice(0, -1).join(', ')} and ${named.at(-1)}`;
}

/** Tells the window when an operation it ran kept files aside. */
export function useKeptAsideNotice(): void {
  useUvcsEvent('filesKeptAside', ({ files }) => noteKeptAside(files));
}
