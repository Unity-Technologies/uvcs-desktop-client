import { File, FileSymlink, Folder } from 'lucide-react';
import type { ItemType } from '@shared/domain/pendingChanges';
import { fileFamilyOf, type FileFamily } from './fileFamily';
import { FAMILY_GLYPHS } from './fileGlyph';
import styles from './ItemIcon.module.css';

interface ItemIconProps {
  itemType: ItemType;
  /** Its file name, which picks the glyph. */
  name: string;
}

const SIZE = 16;

function familyOf(itemType: ItemType, name: string): FileFamily {
  const family = fileFamilyOf(name);
  return family === 'plain' && itemType === 'binaryFile' ? 'binary' : family;
}

/**
 * What an item is, at a glance: a solid folder, or a filled page, the same for every file, whose glyph tells its
 * family in the family's tint: what you write (source, scripts) apart from what builds it (project and build files)
 * and what's generated for you (lockfiles, Unity's .meta files: the plain page), then config, docs, images, media,
 * Unity assets, archives and binaries. Lucide's outlines; the page is drawn once, beneath the glyph.
 */
export function ItemIcon({ itemType, name }: ItemIconProps) {
  if (itemType === 'directory' || itemType === 'xlink') {
    return (
      <span className={styles.icon} aria-hidden>
        <Folder size={SIZE} className={styles.folder} />
      </span>
    );
  }
  const family = itemType === 'symlink' ? 'plain' : familyOf(itemType, name);
  const Glyph = itemType === 'symlink' ? FileSymlink : FAMILY_GLYPHS[family];
  return (
    <span className={styles.icon} data-family={family} aria-hidden>
      <File size={SIZE} className={styles.page} />
      {Glyph && <Glyph size={SIZE} className={styles.glyph} />}
    </span>
  );
}
