import * as Popover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import styles from './FilterPopover.module.css';

interface FilterPopoverProps {
  /** The filter's chip; it opens the popover. */
  trigger: ReactNode;
  children: ReactNode;
  /** Pixels. */
  width?: number;
}

/**
 * The popover of a filter that picks from many (branches, people): under its chip, its content rendered only while
 * open. Esc first empties the search typed in it, then closes it.
 */
export function FilterPopover({ trigger, children, width = 300 }: FilterPopoverProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.popover}
          style={{ width }}
          align="start"
          sideOffset={4}
          collisionPadding={8}
          onEscapeKeyDown={(event) => {
            // The field clears itself on Esc; only an empty one lets the popover close.
            if (event.target instanceof HTMLInputElement && event.target.value) event.preventDefault();
          }}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
