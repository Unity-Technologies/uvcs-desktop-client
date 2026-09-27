import type { CSSProperties } from 'react';
import { FileSymlink } from 'lucide-react';
import type { ItemType } from '@shared/domain/pendingChanges';
import { fileIconOf } from './fileIcon';
import { materialIconUrl } from './materialIconUrl';
import styles from './ItemIcon.module.css';

interface ItemIconProps {
  itemType: ItemType;
  /** Its file name, which picks the icon. */
  name: string;
}

const cssUrl = (name: string): string => `url(${materialIconUrl(name)})`;
/** The theme's folder and page, drawn in the app's own `--icon-*` tokens. */
const FOLDER = { '--icon-shape': cssUrl('folder') } as CSSProperties;
const PAGE = { '--icon-shape': cssUrl('file') } as CSSProperties;

/**
 * What an item is, at a glance: a folder, or its file type's icon in Material Icon Theme (MIT, the icons VS Code's
 * most installed theme draws), in its own colors, the light variant on light themes. Files it has no icon for (a Unity
 * `.meta` file, an unknown extension) are a plain page.
 */
export function ItemIcon({ itemType, name }: ItemIconProps) {
  if (itemType === 'directory' || itemType === 'xlink') return <span className={styles.folder} style={FOLDER} aria-hidden />;
  if (itemType === 'symlink') {
    return (
      <span className={styles.icon} aria-hidden>
        <FileSymlink size={16} className={styles.symlink} />
      </span>
    );
  }
  const icon = fileIconOf(name);
  if (!icon) return <span className={styles.page} style={PAGE} aria-hidden />;
  const colors = { '--icon-dark': cssUrl(icon.dark), '--icon-light': cssUrl(icon.light) } as CSSProperties;
  return <span className={styles.file} style={colors} aria-hidden />;
}
