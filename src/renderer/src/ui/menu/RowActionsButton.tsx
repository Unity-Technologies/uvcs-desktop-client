import { Ellipsis } from 'lucide-react';
import type { Ref } from 'react';
import type { MenuEntry } from '../../lib/actions';
import { hotkey } from '../../lib/shortcutRegistry';
import { ActionDropdownMenu } from './ActionDropdownMenu';
import styles from './RowActionsButton.module.css';

interface RowActionsButtonProps {
  /** Built as the menu opens. */
  entries: MenuEntry[] | (() => MenuEntry[]);
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes once the menu closes: back to the list's filter, so typing carries on. */
  onCloseAutoFocus: (event: Event) => void;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * The "…" on the highlighted result of a list driven from its filter field (the palette, Go to file, the branch and
 * workspace switchers). It opens the result's actions, as Tab (`isRowMenuKey`) and a right click on the row do: the
 * three open this one menu, at this button, in every such list.
 */
export function RowActionsButton({ entries, open, onOpenChange, onCloseAutoFocus, ref }: RowActionsButtonProps) {
  return (
    <ActionDropdownMenu entries={entries} open={open} onOpenChange={onOpenChange} onCloseAutoFocus={onCloseAutoFocus}>
      <button
        ref={ref}
        type="button"
        tabIndex={-1}
        className={styles.actions}
        aria-label="Actions"
        data-tip="Actions"
        data-tip-shortcut={hotkey('rowActions')}
        // The row picks its result on click; its actions button must not.
        onClick={(event) => event.stopPropagation()}
      >
        <Ellipsis size={15} />
      </button>
    </ActionDropdownMenu>
  );
}
