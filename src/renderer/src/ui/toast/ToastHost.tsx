import { Fragment } from 'react';
import { ToastCard } from './ToastCard';
import { useToastStore, type Toast, type ToastAction } from './toastStore';
import styles from './Toast.module.css';

interface ToastHostProps {
  /** An action for error toasts that have none, e.g. to show the failure's details. */
  errorAction?: (title: string, error: unknown) => ToastAction | undefined;
  /** Draws the card of a toast that follows an operation (`operationId`). */
  renderOperation?: (toast: Toast, dismiss: () => void) => React.ReactNode;
  /**
   * Cards of the app's own (`CornerCard`) that stack with the toasts, under them, nearest the corner: the question
   * about profile pictures, the app's update.
   */
  children?: React.ReactNode;
}

export function ToastHost({ errorAction, renderOperation, children }: ToastHostProps) {
  const { toasts, dismiss } = useToastStore();
  const actionOf = (toast: Toast): ToastAction | undefined =>
    toast.action ?? (toast.kind === 'error' && toast.error !== undefined ? errorAction?.(toast.title, toast.error) : undefined);

  return (
    <div className={styles.host}>
      {toasts.map((toast) =>
        toast.operationId && renderOperation ? (
          <Fragment key={toast.id}>{renderOperation(toast, () => dismiss(toast.id))}</Fragment>
        ) : (
          <ToastCard key={toast.id} toast={toast} action={actionOf(toast)} dismiss={() => dismiss(toast.id)} />
        ),
      )}
      {children}
    </div>
  );
}
