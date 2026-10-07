import type { CSSProperties, ReactNode } from 'react';
import styles from './FileTree.module.css';

interface FileTreeCellProps {
  depth: number;
  /** The list is a tree: a file leaves the room of the chevron its sibling folders have. */
  tree: boolean;
  folder: boolean;
  children: ReactNode;
}

/** A row of a list of changed files, indented to its depth when the list is a tree (`useFileTree`). */
export function FileTreeCell({ depth, tree, folder, children }: FileTreeCellProps) {
  return (
    <span className={styles.cell} style={{ '--tree-depth': depth } as CSSProperties} data-chevron-room={(tree && !folder) || undefined}>
      {children}
    </span>
  );
}
