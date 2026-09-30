import { File, Folder } from 'lucide-react';
import type { ItemType } from '@shared/domain/pendingChanges';
import { itemIconShape } from './fileGlyph';
import styles from './ItemIcon.module.css';

interface ItemIconProps {
  itemType: ItemType;
  /** Its file name, which picks the glyph. */
  name: string;
}

const SIZE = 16;

/**
 * What an item is, at a glance: a solid folder, or a filled page, the same for every file, whose glyph tells its
 * family in the family's tint: what you write (source, scripts) apart from what builds it (project and build files)
 * and what's generated for you (lockfiles, Unity's .meta files: the plain page), then config, docs, images, media,
 * Unity assets, archives and binaries (`itemIconShape`). Lucide's outlines; the page is drawn once, beneath the glyph.
 */
export function ItemIcon({ itemType, name }: ItemIconProps) {
  const shape = itemIconShape(itemType, name);
  if (shape.kind === 'folder') {
    return (
      <span className={styles.icon} aria-hidden>
        <Folder size={SIZE} className={styles.folder} />
      </span>
    );
  }
  const Glyph = shape.glyph;
  return (
    <span className={styles.icon} data-family={shape.family} aria-hidden>
      <File size={SIZE} className={styles.page} />
      {Glyph && <Glyph size={SIZE} className={styles.glyph} />}
    </span>
  );
}
