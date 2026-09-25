import type { ContentSource } from '@shared/domain/content';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { categoryOf } from './changeCategories';

/** What to compare to show a pending change: the loaded revision against the file on disk. */
export function changeDiffSources(change: PendingChange): { original: ContentSource; modified: ContentSource } {
  const onDisk: ContentSource = { kind: 'workspaceFile', path: change.path };
  const loaded: ContentSource = { kind: 'workspaceBase', path: change.path };

  switch (categoryOf(change)) {
    case 'added':
    case 'private':
    case 'ignored':
    case 'cloaked':
      return { original: { kind: 'empty' }, modified: onDisk };
    case 'deleted':
      return { original: loaded, modified: { kind: 'empty' } };
    default:
      return { original: loaded, modified: onDisk };
  }
}
