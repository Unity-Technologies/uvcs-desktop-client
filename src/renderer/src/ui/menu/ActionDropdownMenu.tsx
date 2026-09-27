import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ReactElement } from 'react';
import type { MenuEntry } from '../../lib/actions';
import { MenuEntries, type MenuPrimitives } from './MenuEntries';
import styles from './Menu.module.css';
import { focusAfterMenu } from './focusAfterMenu';

const primitives: MenuPrimitives = {
  Item: DropdownMenu.Item,
  Separator: DropdownMenu.Separator,
  Sub: DropdownMenu.Sub,
  SubTrigger: DropdownMenu.SubTrigger,
  SubContent: DropdownMenu.SubContent,
  Portal: DropdownMenu.Portal,
};

interface ActionDropdownMenuProps {
  entries: MenuEntry[];
  align?: 'start' | 'end';
  children: ReactElement;
  /** Opens and closes it from outside too, e.g. from the keyboard; uncontrolled without it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Where focus goes once it closes, instead of back to the trigger. */
  onCloseAutoFocus?: (event: Event) => void;
}

export function ActionDropdownMenu({ entries, align = 'end', children, open, onOpenChange, onCloseAutoFocus }: ActionDropdownMenuProps) {
  return (
    <DropdownMenu.Root modal={false} open={open} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.content}
          align={align}
          sideOffset={4}
          onCloseAutoFocus={(event) => focusAfterMenu(event, onCloseAutoFocus)}
          // React bubbles events out of portals to the trigger's ancestors: an item picked (Enter clicks it too) must not
          // also click the row the menu belongs to (the palette's Delete… opened the branch as well).
          onClick={(event) => event.stopPropagation()}
        >
          <MenuEntries entries={entries} primitives={primitives} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
