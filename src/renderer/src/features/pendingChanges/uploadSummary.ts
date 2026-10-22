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

/** What a change adds to an upload: nothing, or its bytes as a new file or as an edited one (`uploadKindOf`). */
export type UploadKind = 'none' | 'new' | 'edited';

export function uploadKindOf(change: PendingChange): UploadKind {
  if (change.itemType === 'directory' || !existsOnDisk(change)) return 'none';
  const category = categoryOf(change);
  if (category === 'added' || category === 'private') return 'new';
  return hasContentChanges(change) ? 'edited' : 'none';
}

/** Adds changes up into an `UploadSummary`, each with its `uploadKindOf` worked out beforehand when many are added again and again. */
export class UploadTally {
  private bytes = 0;
  private newFiles = 0;
  private editedFiles = 0;
  private largest: PendingChange | null = null;

  add(change: PendingChange, kind: UploadKind = uploadKindOf(change)): void {
    if (kind === 'none') return;
    this.bytes += change.size;
    if (kind === 'new') this.newFiles++;
    else this.editedFiles++;
    if (!this.largest || change.size > this.largest.size) this.largest = change;
  }

  summary(): UploadSummary {
    return { bytes: this.bytes, newFiles: this.newFiles, editedFiles: this.editedFiles, largest: this.largest };
  }
}

/** One pass over the changes: checking a box goes over tens of thousands of them again. */
export function uploadSummary(changes: PendingChange[]): UploadSummary {
  const tally = new UploadTally();
  for (const change of changes) tally.add(change);
  return tally.summary();
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
