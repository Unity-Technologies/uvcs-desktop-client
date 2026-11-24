import { MoreHorizontal } from 'lucide-react';
import type { MenuEntry } from '../../../lib/actions';
import { IconButton } from '../../../ui/IconButton';
import { ActionDropdownMenu } from '../../../ui/menu/ActionDropdownMenu';
import styles from './ReviewConversation.module.css';

/** A comment's "…" menu (`useCommentMenu`), shown under the pointer or while open or focused (`.commentMenu`). */
export function CommentMenuButton({ entries }: { entries: MenuEntry[] }) {
  return (
    <span className={styles.commentMenu}>
      <ActionDropdownMenu entries={entries}>
        <IconButton size="small" icon={<MoreHorizontal size={14} />} label="Comment actions" />
      </ActionDropdownMenu>
    </span>
  );
}
