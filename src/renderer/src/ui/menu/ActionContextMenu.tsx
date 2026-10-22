import * as ContextMenu from '@radix-ui/react-context-menu';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import type { MenuEntry } from '../../lib/actions';
import { MenuEntries, type MenuPrimitives } from './MenuEntries';
import styles from './Menu.module.css';
import { focusAfterMenu } from './focusAfterMenu';

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
  /** Runs before the menu opens; preventing the event's default opens none. */
  onContextMenu?: (event: ReactMouseEvent) => void;
}

export function ActionContextMenu({ entries, children, onCloseAutoFocus, onContextMenu }: ActionContextMenuProps) {
  return (
    <ContextMenu.Root modal={false}>
      <ContextMenu.Trigger asChild onContextMenu={onContextMenu}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={styles.content} onCloseAutoFocus={(event) => focusAfterMenu(event, onCloseAutoFocus)}>
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
