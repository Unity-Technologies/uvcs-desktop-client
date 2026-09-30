import { MoreHorizontal } from 'lucide-react';
import { COPY_ENTRY_IDS } from '../../components/copyMenu';
import { runningFirst, withoutAction } from '../../lib/actions';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { Highlight } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import type { MyShelve } from './myShelves';
import { shelveMenu } from './shelveMenu';
import { applyShelve, showShelveChanges } from './shelveOperations';
import styles from './MyShelvesList.module.css';

interface MyShelveRowProps {
  workspacePath: string;
  row: MyShelve;
  /** Closes the popover: every action here goes on without it on top. */
  onDone: () => void;
}

/** A shelve in Changes' list: the row opens its diff, Apply (or Restore) merges it here, the rest is behind "More actions". */
export function MyShelveRow({ workspacePath, row, onDone }: MyShelveRowProps) {
  const { shelve, title, spec, detail, author, mine, left } = row;
  return (
    <li className={styles.row}>
      <button
        type="button"
        className={styles.open}
        data-shelve-row
        data-tip={left ? 'Show the changes left here' : 'Show the shelved changes'}
        onClick={() => {
          onDone();
          showShelveChanges(shelve);
        }}
      >
        {author !== null && <Avatar user={shelve.owner} size={20} tip={null} />}
        <span className={styles.text}>
          <span className={styles.title}>
            <Highlight text={title} />
          </span>
          <span className={styles.detail}>
            {author !== null && (
              <span className={mine ? styles.me : styles.author}>
                <Highlight text={author} /> ·{' '}
              </span>
            )}
            <Highlight text={spec} /> · {detail}
          </span>
        </span>
      </button>
      <Button
        size="small"
        data-tip={left ? 'Apply the changes and delete the shelve' : 'Merge the shelved changes here; the shelve stays'}
        onClick={() => {
          onDone();
          void applyShelve(workspacePath, shelve.id, left);
        }}
      >
        {left ? 'Restore' : 'Apply'}
      </Button>
      <ActionDropdownMenu entries={runningFirst(withoutAction(shelveMenu(workspacePath, [shelve], { left, mine }), 'apply'), onDone, COPY_ENTRY_IDS)}>
        <IconButton size="small" icon={<MoreHorizontal size={14} />} label="More actions" />
      </ActionDropdownMenu>
    </li>
  );
}
