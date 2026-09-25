import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { Spinner } from '../Spinner';
import { AUTO_DISMISS_MS, useToastStore, type Toast, type ToastAction, type ToastKind } from './toastStore';
import styles from './Toast.module.css';

const ICONS: Record<ToastKind, React.ReactNode> = {
  info: <Info size={16} className={styles.infoIcon} />,
  success: <CheckCircle2 size={16} className={styles.successIcon} />,
  error: <AlertCircle size={16} className={styles.errorIcon} />,
  progress: <Spinner size={14} />,
};

interface ToastHostProps {
  /** An action for error toasts that have none, e.g. to show the failure's details. */
  errorAction?: (title: string, error: unknown) => ToastAction | undefined;
}

export function ToastHost({ errorAction }: ToastHostProps) {
  const { toasts, dismiss } = useToastStore();
  const actionOf = (toast: Toast): ToastAction | undefined =>
    toast.action ?? (toast.kind === 'error' && toast.error !== undefined ? errorAction?.(toast.title, toast.error) : undefined);

  return (
    <div className={styles.host} role="status" aria-live="polite">
      {toasts.map((toast) => {
        const action = actionOf(toast);
        return (
          <div key={toast.id} className={styles.toast} data-kind={toast.kind}>
            <span className={styles.icon}>{ICONS[toast.kind]}</span>
            <div className={styles.text}>
              <div className={styles.title}>{toast.title}</div>
              {toast.detail && <div className={`${styles.detail} selectable`}>{toast.detail}</div>}
            </div>
            {action && (
              <button
                className={styles.action}
                onClick={() => {
                  action.run();
                  if (toast.kind !== 'progress') dismiss(toast.id);
                }}
              >
                {action.label}
              </button>
            )}
            {toast.kind !== 'progress' && (
              <button className={styles.close} onClick={() => dismiss(toast.id)} aria-label="Dismiss">
                <X size={13} />
              </button>
            )}
            {/* The bar is the timer: dismissal fires when it runs out, so the two can't drift apart. Keyed on the kind so a
              finished progress toast starts its countdown fresh. */}
            {AUTO_DISMISS_MS[toast.kind] !== null && (
              <span
                key={toast.kind}
                className={styles.countdown}
                style={{ animationDuration: `${AUTO_DISMISS_MS[toast.kind]}ms` }}
                onAnimationEnd={() => dismiss(toast.id)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
