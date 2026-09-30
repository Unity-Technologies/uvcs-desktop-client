import {
  FileArchive,
  FileBox,
  FileBraces,
  FileCode,
  FileCog,
  FileDigit,
  FileImage,
  FilePlay,
  FileTerminal,
  FileSymlink,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import type { ItemType } from '@shared/domain/pendingChanges';
import { fileFamilyOf, type FileFamily } from './fileFamily';

/** Each family's glyph on the page (Lucide's), `null` for the plain page: generated files and unknown types. */
export const FAMILY_GLYPHS: Record<FileFamily, LucideIcon | null> = {
  source: FileCode,
  script: FileTerminal,
  project: FileCog,
  config: FileBraces,
  generated: null,
  docs: FileText,
  image: FileImage,
  media: FilePlay,
  asset: FileBox,
  archive: FileArchive,
  binary: FileDigit,
  plain: null,
};

/** What an item's icon draws: a folder, or the page with a glyph (none for the plain page) tinted by its family. */
export type ItemIconShape = { kind: 'folder' } | { kind: 'page'; family: FileFamily; glyph: LucideIcon | null };

/**
 * The icon of an item: a folder for directories and xlinks; for a file, its family's glyph by its name, a file `cm`
 * calls binary counting as one when its name tells nothing; a symlink's own arrow, untinted.
 */
export function itemIconShape(itemType: ItemType, name: string): ItemIconShape {
  if (itemType === 'directory' || itemType === 'xlink') return { kind: 'folder' };
  if (itemType === 'symlink') return { kind: 'page', family: 'plain', glyph: FileSymlink };
  const named = fileFamilyOf(name);
  const family = named === 'plain' && itemType === 'binaryFile' ? 'binary' : named;
  return { kind: 'page', family, glyph: FAMILY_GLYPHS[family] };
}
