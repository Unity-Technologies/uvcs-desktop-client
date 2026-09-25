import * as ContextMenu from '@radix-ui/react-context-menu';
import type { ReactNode } from 'react';
import type { MenuEntry } from '../../lib/actions';
import { MenuEntries, type MenuPrimitives } from './MenuEntries';
import styles from './Menu.module.css';

const primitives: MenuPrimitives = {
  Item: ContextMenu.Item,
  Separator: ContextMenu.Separator,
  Sub: ContextMenu.Sub,
  SubTrigger: ContextMenu.SubTrigger,
  SubContent: ContextMenu.SubContent,
  Portal: ContextMenu.Portal,
};

interface ActionContextMenuProps {
  /** Built lazily when the menu opens, so it always reflects the current selection. */
  entries: () => MenuEntry[];
  children: ReactNode;
}

export function ActionContextMenu({ entries, children }: ActionContextMenuProps) {
  return (
    <ContextMenu.Root modal={false}>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={styles.content}>
          <MenuEntries entries={entries()} primitives={primitives} />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
