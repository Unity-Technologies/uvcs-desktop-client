import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import styles from './FileTree.module.css';

interface FileTreeCellProps {
  /** How many groups and folders hold the row: its indent, and the guides it draws, one under each one's chevron. */
  depth: number;
  /** The list is a tree: a file leaves the room of the chevron its sibling folders have. */
  tree: boolean;
  folder: boolean;
  children: ReactNode;
}

/** The indent guides of a row: drawn, and the level of the one drawn stronger (`activeIndentGuide`), if any. */
export interface RowGuides {
  active: number | undefined;
}

/**
 * The guides of the row: given by `FileTreeList` around each row, which alone knows the selection and lays its rows
 * out where the guides can run from one to the next. Null elsewhere (a details panel's short list), which draws none.
 */
export const RowGuidesContext = createContext<RowGuides | null>(null);

/**
 * A row of a list of changed files, indented to its depth, with a guide line down from the chevron of each group and
 * folder holding it, so how deep it sits reads at a glance.
 */
export function FileTreeCell({ depth, tree, folder, children }: FileTreeCellProps) {
  const guides = useContext(RowGuidesContext);
  const active = guides?.active;
  const style = { '--tree-depth': depth, '--active-guide': active } as CSSProperties;
  return (
    <span
      className={styles.cell}
      style={style}
      data-chevron-room={(tree && !folder) || undefined}
      data-guides={guides !== null || undefined}
      data-active-guide={active !== undefined || undefined}
    >
      {children}
    </span>
  );
}
