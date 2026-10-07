import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatCount } from '../lib/text';
import { Highlight } from '../ui/Highlight';
import { ItemIcon } from './ItemIcon';
import { ItemRow, type ItemPresence } from './ItemRow';
import { ItemStatusMark, type ItemStatusMarkProps } from './ItemStatusMark';
import styles from './FileTree.module.css';

interface TreeFolderLabelProps {
  /** The folders the row shows ("deep/very" for folders that only hold the next one). */
  name: string;
  collapsed: boolean;
  /** How many items it holds, shown while it is closed. */
  count: number;
  /** Between the chevron and the icon: the Changes list's checkbox. */
  before?: ReactNode;
  /** The folder's own change, when it is one: every folder of a list of changes holds some, so only its own marks it. */
  status?: ItemStatusMarkProps['status'];
  presence?: ItemPresence;
  deleted?: boolean;
  /** The review mark. */
  extras?: ReactNode;
  faded?: boolean;
}

/** A folder of a tree of changed files, the same in every list: its chevron, icon and name, and its count while closed. */
export function TreeFolderLabel({ name, collapsed, count, before, status, presence, deleted, extras, faded }: TreeFolderLabelProps) {
  return (
    <>
      <ChevronRight size={13} className={styles.chevron} data-collapsed={collapsed} aria-hidden />
      {before}
      <ItemRow
        icon={<ItemIcon itemType="directory" name={name} />}
        label={
          <>
            <span className={styles.folderName} data-tip={name.includes('/') ? name : undefined}>
              <Highlight text={name} />
            </span>
            {collapsed && <span className={styles.count}>{formatCount(count)}</span>}
          </>
        }
        extras={extras}
        status={<ItemStatusMark status={status} />}
        presence={presence}
        deleted={deleted}
        faded={faded}
      />
    </>
  );
}
