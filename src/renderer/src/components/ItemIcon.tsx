import {
  File,
  FileArchive,
  FileBox,
  FileBraces,
  FileCode,
  FileDigit,
  FileImage,
  FilePlay,
  FileSymlink,
  FileText,
  Folder,
  type LucideIcon,
} from 'lucide-react';
import type { ItemType } from '@shared/domain/pendingChanges';
import { fileKindOf, type FileKind } from './fileKind';
import styles from './ItemIcon.module.css';

const GLYPHS: Record<FileKind, LucideIcon | null> = {
  code: FileCode,
  data: FileBraces,
  text: FileText,
  image: FileImage,
  media: FilePlay,
  archive: FileArchive,
  asset: FileBox,
  binary: FileDigit,
  meta: null,
  plain: null,
};

interface ItemIconProps {
  itemType: ItemType;
  /** Its file name, whose extension picks the glyph. */
  name: string;
}

const SIZE = 16;

/**
 * What an item is, at a glance: a solid folder, or a filled page whose glyph tells the family of the file (code,
 * image, Unity asset...). Color stays for statuses: every file is the same neutral page. Lucide's outlines, filled:
 * a plain page under the glyph's own, so each icon reads solid whatever its glyph leaves open.
 */
export function ItemIcon({ itemType, name }: ItemIconProps) {
  if (itemType === 'directory' || itemType === 'xlink') {
    return (
      <span className={styles.icon} aria-hidden>
        <Folder size={SIZE} className={styles.folder} />
      </span>
    );
  }
  const kind = itemType === 'symlink' ? 'plain' : fileKindOf(name);
  const Glyph = itemType === 'symlink' ? FileSymlink : (GLYPHS[kind] ?? (itemType === 'binaryFile' ? FileDigit : null));
  return (
    <span className={styles.icon} data-kind={kind} aria-hidden>
      <File size={SIZE} className={styles.page} />
      {Glyph && <Glyph size={SIZE} className={styles.glyph} />}
    </span>
  );
}
