import { ChevronRight } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { isSubmenu, SEPARATOR, type MenuEntry } from '../../lib/actions';
import { classNames } from '../../lib/classNames';
import { Kbd } from '../Kbd';
import styles from './Menu.module.css';

type Primitive = ComponentType<{
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  'data-tip'?: string;
  onSelect?: () => void;
  sideOffset?: number;
}>;

/** Radix context menus and dropdown menus share the same anatomy; this lets one renderer serve both. */
export interface MenuPrimitives {
  Item: Primitive;
  Separator: Primitive;
  Sub: Primitive;
  SubTrigger: Primitive;
  SubContent: Primitive;
  Portal: Primitive;
}

export function MenuEntries({ entries, primitives }: { entries: MenuEntry[]; primitives: MenuPrimitives }) {
  const { Item, Separator, Sub, SubTrigger, SubContent, Portal } = primitives;

  return entries.map((entry, index) => {
    if (entry === SEPARATOR) return <Separator key={`separator-${index}`} className={styles.separator} />;

    if (isSubmenu(entry)) {
      const SubmenuIcon = entry.icon;
      return (
        <Sub key={entry.id ?? entry.label}>
          <SubTrigger className={styles.item}>
            <span className={styles.icon}>{SubmenuIcon && <SubmenuIcon size={14} />}</span>
            <span className={styles.label}>{entry.label}</span>
            <ChevronRight size={13} className={styles.trailing} />
          </SubTrigger>
          <Portal>
            <SubContent className={styles.content} sideOffset={2}>
              <MenuEntries entries={entry.entries} primitives={primitives} />
            </SubContent>
          </Portal>
        </Sub>
      );
    }

    const ActionIcon = entry.icon;
    return (
      <Item
        key={entry.id}
        className={classNames(styles.item, entry.danger && styles.danger)}
        disabled={entry.disabled}
        data-tip={entry.disabled ? entry.disabledReason : undefined}
        onSelect={() => runAfterMenuCloses(entry.run)}
      >
        <span className={styles.icon}>{ActionIcon && <ActionIcon size={14} />}</span>
        <span className={styles.label}>{entry.label}</span>
        {entry.detail && <span className={styles.detail}>{entry.detail}</span>}
        {entry.shortcut && (
          <span className={styles.trailing}>
            <Kbd keys={entry.shortcut} />
          </span>
        )}
      </Item>
    );
  });
}

/**
 * Menu actions often open dialogs. Running them after the menu has closed and restored focus
 * keeps the menu from lingering on screen and stealing the dialog's keyboard input.
 */
function runAfterMenuCloses(action: () => void): void {
  setTimeout(action, 0);
}
