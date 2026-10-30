import * as RadixDialog from '@radix-ui/react-dialog';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { MODAL_DIALOG } from '../../lib/modalDialog';
import styles from './Dialog.module.css';

interface DialogProps {
  /** A picture before the title, such as the app's mark (What's New). */
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** A small control at the header's top right, for something the dialog rarely needs changed (where it starts). */
  headerAction?: ReactNode;
  width?: number;
  onClose: () => void;
  /** Submitting the form (e.g. pressing Enter) runs this. */
  onSubmit?: () => void;
  footer?: ReactNode;
  children?: ReactNode;
}

export function Dialog({ icon, title, description, headerAction, width, onClose, onSubmit, footer, children }: DialogProps) {
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
            <div className={styles.header} data-icon={icon ? true : undefined}>
              {icon}
              <div className={styles.heading}>
                <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
                {description && <RadixDialog.Description className={styles.description}>{description}</RadixDialog.Description>}
              </div>
              {headerAction}
            </div>
            {children && <div className={styles.body}>{children}</div>}
            {footer && <div className={styles.footer}>{footer}</div>}
          </form>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
