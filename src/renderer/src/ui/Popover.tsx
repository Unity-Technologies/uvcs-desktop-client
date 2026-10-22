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
  /** Runs as it opens; prevent its default to focus something other than its first focusable element. */
  onOpenAutoFocus?: (event: Event) => void;
}

/**
 * A raised panel under its trigger, its content rendered only while open. Above dialogs, so one can open from them.
 * New popovers use it (a filter's, `FilterPopover`, too) rather than Radix's directly, so they look and behave alike.
 */
export function Popover({ trigger, children, width = 300, align = 'start', open, onOpenChange, onEscapeKeyDown, onOpenAutoFocus }: PopoverProps) {
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
          onOpenAutoFocus={onOpenAutoFocus}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
