import * as RadixPopover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import styles from './Popover.module.css';

interface PopoverProps {
  /** The control that opens it. */
  trigger: ReactNode;
  children: ReactNode;
  /** Pixels. */
  width?: number;
  /** Which edge of the trigger it lines up with. */
  align?: 'start' | 'end';
  /** Controlled, for a popover that closes on a pick; left out, it opens and closes itself. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
}

/** A raised panel under its trigger, its content rendered only while open. Above dialogs, so one can open from them. */
export function Popover({ trigger, children, width = 300, align = 'start', open, onOpenChange, onEscapeKeyDown }: PopoverProps) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          className={styles.popover}
          style={{ width }}
          align={align}
          sideOffset={4}
          collisionPadding={8}
          onEscapeKeyDown={onEscapeKeyDown}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
