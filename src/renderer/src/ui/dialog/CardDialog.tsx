import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { MODAL_DIALOG } from '../../lib/modalDialog';
import { IconButton } from '../IconButton';
import styles from './CardDialog.module.css';

interface CardDialogProps {
  /** What screen readers call the dialog; the content shows its own heading. */
  label: string;
  width?: number;
  onClose: () => void;
  children: ReactNode;
}

/** A dialog its content lays out, centered, with a close button in its corner and no form or footer (About). */
export function CardDialog({ label, width, onClose, children }: CardDialogProps) {
  return (
    <RadixDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content
          className={styles.content}
          style={{ '--dialog-width': width && `${width}px` } as CSSProperties}
          aria-describedby={undefined}
          {...MODAL_DIALOG}
        >
          <RadixDialog.Title className="visually-hidden">{label}</RadixDialog.Title>
          <RadixDialog.Close asChild>
            <IconButton className={styles.close} icon={<X size={15} />} label="Close" size="small" />
          </RadixDialog.Close>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
