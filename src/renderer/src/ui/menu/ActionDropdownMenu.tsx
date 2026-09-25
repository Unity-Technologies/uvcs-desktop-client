import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ReactElement } from 'react';
import type { MenuEntry } from '../../lib/actions';
import { MenuEntries, type MenuPrimitives } from './MenuEntries';
import styles from './Menu.module.css';

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
        <DropdownMenu.Content className={styles.content} align={align} sideOffset={4} onCloseAutoFocus={onCloseAutoFocus}>
          <MenuEntries entries={entries} primitives={primitives} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
