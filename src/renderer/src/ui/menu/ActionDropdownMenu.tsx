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
}

export function ActionDropdownMenu({ entries, align = 'end', children }: ActionDropdownMenuProps) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.content} align={align} sideOffset={4}>
          <MenuEntries entries={entries} primitives={primitives} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
