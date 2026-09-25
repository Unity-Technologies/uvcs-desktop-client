import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import type { ReactElement } from 'react';
import type { Icon } from '../../lib/actions';
import styles from './DescribedMenu.module.css';

export interface DescribedMenuItem {
  id: string;
  label: string;
  /** One line on what the item does, under its label. */
  description: string;
  icon?: Icon;
  /** Shown on hover, e.g. the exact `cm` command the item runs. */
  tip?: string;
  /** Marks the current choice, e.g. the selected theme. */
  checked?: boolean;
  disabled?: boolean;
  run: () => void;
}

interface DescribedMenuProps {
  items: DescribedMenuItem[];
  /** A small heading above the items. */
  title?: string;
  align?: 'start' | 'end';
  children: ReactElement;
}

/** A dropdown whose items explain themselves: a label, a line of description and an optional hover tip. */
export function DescribedMenu({ items, title, align = 'end', children }: DescribedMenuProps) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.content} align={align} sideOffset={4}>
          {title && <DropdownMenu.Label className={styles.title}>{title}</DropdownMenu.Label>}
          {items.map((item) => {
            const ItemIcon = item.icon;
            return (
              <DropdownMenu.Item
                key={item.id}
                className={styles.item}
                disabled={item.disabled}
                data-tip={item.tip}
                role={item.checked === undefined ? undefined : 'menuitemradio'}
                aria-checked={item.checked}
                onSelect={() => setTimeout(item.run, 0)}
              >
                <span className={styles.icon}>{ItemIcon && <ItemIcon size={15} />}</span>
                <span className={styles.text}>
                  <span className={styles.label}>{item.label}</span>
                  <span className={styles.description}>{item.description}</span>
                </span>
                {item.checked && <Check size={14} className={styles.check} />}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
