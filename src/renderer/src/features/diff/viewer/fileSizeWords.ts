// The words a diff that shows no content uses for the sizes of its versions (`NothingToDiff`, and the image diff where
// a version can't be painted): one way to say a file is too large, and how its size changed.

import type { FileContent } from '@shared/domain/content';
import { formatSize } from '../../../lib/formatDate';

export const TOO_LARGE_TITLES: Record<NonNullable<FileContent['tooLarge']>, string> = {
  text: 'This file is too large to show a diff',
  image: 'This image is too large to preview',
  model: 'This model is too large to preview',
};

/** "1.2 KB → 3.4 KB": the version before's size, then the version after's; "Purged" for one a purge removed. */
export function sizeChange(left: Pick<FileContent, 'size' | 'purged'>, right: Pick<FileContent, 'size' | 'purged'>): string {
  return `${sizeOf(left)} → ${sizeOf(right)}`;
}

function sizeOf(version: Pick<FileContent, 'size' | 'purged'>): string {
  return version.purged ? 'Purged' : formatSize(version.size);
}
