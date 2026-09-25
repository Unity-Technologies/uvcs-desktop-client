import { Check, File, FileImage, Folder, FolderOpen, Link2 } from 'lucide-react';
import type { TreeItem } from '@shared/domain/explorer';
import type { IconOverlay } from './itemStatus';
import styles from './ItemIcon.module.css';

const IMAGE_EXTENSION = /\.(png|jpe?g|gif|bmp|webp|psd|tga|exr|ico)$/i;

/** A file or folder icon with a small status mark in its corner (`overlay`), so the tree reads like the desktop GUI's. */
export function ItemIcon({ item, expanded, overlay }: { item: TreeItem; expanded: boolean; overlay: IconOverlay }) {
  return (
    <span className={styles.icon}>
      <BaseIcon item={item} expanded={expanded} />
      <span className={styles.overlay} data-overlay={overlay} aria-hidden>
        {overlay === 'controlled' && <Check size={6} strokeWidth={4} />}
        {overlay === 'xlink' && <Link2 size={8} strokeWidth={3} />}
      </span>
    </span>
  );
}

function BaseIcon({ item, expanded }: { item: TreeItem; expanded: boolean }) {
  if (item.itemType === 'directory') {
    const Icon = expanded ? FolderOpen : Folder;
    return <Icon size={14} className={styles.folder} />;
  }
  if (item.itemType === 'xlink') return <Link2 size={14} className={styles.file} />;
  if (IMAGE_EXTENSION.test(item.name)) return <FileImage size={14} className={styles.file} />;
  return <File size={14} className={styles.file} />;
}
