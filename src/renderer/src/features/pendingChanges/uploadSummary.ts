import type { PendingChange } from '@shared/domain/pendingChanges';
import { formatSize } from '../../lib/formatDate';
import { fileNameOf, formatCount, pluralize } from '../../lib/text';
import { categoryOf, existsOnDisk, hasContentChanges } from './changeCategories';

/**
 * What a check-in or shelve uploads: the whole content of new files and edited ones, as they are on disk (what
 * `cm status` reports as their size, and what `cm checkin` totals as it uploads). Moves, deletions and folders upload nothing.
 */
export interface UploadSummary {
  bytes: number;
  newFiles: number;
  editedFiles: number;
  /** The biggest file uploaded, or null when nothing is. */
  largest: PendingChange | null;
}

/** One pass over the changes: checking a box goes over tens of thousands of them again. */
export function uploadSummary(changes: PendingChange[]): UploadSummary {
  let bytes = 0;
  let newFiles = 0;
  let editedFiles = 0;
  let largest: PendingChange | null = null;
  for (const change of changes) {
    if (change.itemType === 'directory' || !existsOnDisk(change)) continue;
    const category = categoryOf(change);
    const isNew = category === 'added' || category === 'private';
    if (!isNew && !hasContentChanges(change)) continue;
    bytes += change.size;
    if (isNew) newFiles++;
    else editedFiles++;
    if (!largest || change.size > largest.size) largest = change;
  }
  return { bytes, newFiles, editedFiles, largest };
}

/** For the button's tooltip: "Uploads 1.1 MB: 3 new files, 2 edited" and, with several files, "Largest: Hero.psd · 820 KB". */
export function describeUpload({ bytes, newFiles, editedFiles, largest }: UploadSummary): string | null {
  if (bytes === 0) return null;
  const files = [
    newFiles > 0 && pluralize(newFiles, 'new file'),
    editedFiles > 0 && (newFiles > 0 ? `${formatCount(editedFiles)} edited` : pluralize(editedFiles, 'edited file')),
  ].filter(Boolean);
  const lines = [`Uploads ${formatSize(bytes)}: ${files.join(', ')}`];
  if (largest && newFiles + editedFiles > 1) lines.push(`Largest: ${fileNameOf(largest.path)} · ${formatSize(largest.size)}`);
  return lines.join('\n');
}
