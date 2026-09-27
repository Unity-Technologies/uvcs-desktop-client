import * as RadixDialog from '@radix-ui/react-dialog';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { MODAL_DIALOG } from '../../lib/modalDialog';
import styles from './Dialog.module.css';

interface DialogProps {
  title: string;
  description?: ReactNode;
  width?: number;
  onClose: () => void;
  /** Submitting the form (e.g. pressing Enter) runs this. */
  onSubmit?: () => void;
  footer?: ReactNode;
  children?: ReactNode;
}

export function Dialog({ title, description, width, onClose, onSubmit, footer, children }: DialogProps) {
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    onSubmit?.();
  };

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
          <form onSubmit={submit} style={{ display: 'contents' }}>
            <div className={styles.header}>
              <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
              {description && <RadixDialog.Description className={styles.description}>{description}</RadixDialog.Description>}
            </div>
            {children && <div className={styles.body}>{children}</div>}
            {footer && <div className={styles.footer}>{footer}</div>}
          </form>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
