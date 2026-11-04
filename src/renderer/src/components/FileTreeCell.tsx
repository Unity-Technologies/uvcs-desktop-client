import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import styles from './FileTree.module.css';

interface FileTreeCellProps {
  /** How many groups and folders hold the row: its indent, and the guides it draws, one under each one's chevron. */
  depth: number;
  /** The list is a tree: a file leaves the room of the chevron its sibling folders have (in a grouped list too: `RowGuides`). */
  tree: boolean;
  folder: boolean;
  children: ReactNode;
}

/** How a row of `FileTreeList` sits among the others: it draws indent guides, and maybe leaves a chevron's room. */
export interface RowGuides {
  /**
   * The list is a tree or has groups: a file leaves the room of a chevron, so what a group or folder holds starts
   * under its name, not under its chevron and badge.
   */
  chevronColumn: boolean;
}

/**
 * The guides of the row: given by `FileTreeList` around its rows, which lays them out where the guides can run from one
 * to the next. Null elsewhere (a details panel's short list), which draws none.
 */
export const RowGuidesContext = createContext<RowGuides | null>(null);

/**
 * A row of a list of changed files, indented to its depth, with a guide line down from the chevron of each group and
 * folder holding it, so how deep it sits reads at a glance.
 */
export function FileTreeCell({ depth, tree, folder, children }: FileTreeCellProps) {
  const guides = useContext(RowGuidesContext);
  const style = { '--tree-depth': depth } as CSSProperties;
  return (
    <span
      className={styles.cell}
      style={style}
      data-chevron-room={((tree || guides?.chevronColumn) && !folder) || undefined}
      data-guides={guides !== null || undefined}
    >
      {children}
    </span>
  );
}
