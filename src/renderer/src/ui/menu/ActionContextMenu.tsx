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
  /** Where focus goes once the menu closes; back to the row it opened on by default. */
  onCloseAutoFocus?: (event: Event) => void;
}

export function ActionContextMenu({ entries, children, onCloseAutoFocus }: ActionContextMenuProps) {
  return (
    <ContextMenu.Root modal={false}>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={styles.content} onCloseAutoFocus={onCloseAutoFocus}>
          <OpenedEntries entries={entries} />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

/** Asks for the entries as the menu opens, even when nothing else re-rendered since what it opens on changed. */
function OpenedEntries({ entries }: { entries: () => MenuEntry[] }) {
  return <MenuEntries entries={entries()} primitives={primitives} />;
}
