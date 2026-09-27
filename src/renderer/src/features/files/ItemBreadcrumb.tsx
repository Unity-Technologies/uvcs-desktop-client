import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { ancestorsOf } from './fileTreeRows';
import styles from './ItemBreadcrumb.module.css';

/** The folders an item is in, each one selecting that folder in the tree. */
export function ItemBreadcrumb({ path, onSelectFolder }: { path: string; onSelectFolder: (path: string) => void }) {
  const folders = ancestorsOf(path);
  if (folders.length === 0) return null;
  return (
    <nav className={styles.breadcrumb} aria-label="Folders">
      {folders.map((folder, index) => (
        <Fragment key={folder}>
          {index > 0 && <ChevronRight size={11} className={styles.separator} aria-hidden />}
          <button className={styles.folder} onClick={() => onSelectFolder(folder)} data-tip={`Select /${folder}`}>
            {folder.slice(folder.lastIndexOf('/') + 1)}
          </button>
        </Fragment>
      ))}
    </nav>
  );
}
