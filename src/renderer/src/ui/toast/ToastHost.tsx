import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { Spinner } from '../Spinner';
import { useToastStore, type ToastKind } from './toastStore';
import styles from './Toast.module.css';

const ICONS: Record<ToastKind, React.ReactNode> = {
  info: <Info size={16} className={styles.infoIcon} />,
  success: <CheckCircle2 size={16} className={styles.successIcon} />,
  error: <AlertCircle size={16} className={styles.errorIcon} />,
  progress: <Spinner size={14} />,
};

export function ToastHost() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div className={styles.host} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toast}>
          <span className={styles.icon}>{ICONS[toast.kind]}</span>
          <div className={styles.text}>
            <div className={styles.title}>{toast.title}</div>
            {toast.detail && <div className={`${styles.detail} selectable`}>{toast.detail}</div>}
          </div>
          {toast.action && (
            <button
              className={styles.action}
              onClick={() => {
                toast.action?.run();
                if (toast.kind !== 'progress') dismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
          {toast.kind !== 'progress' && (
            <button className={styles.close} onClick={() => dismiss(toast.id)} aria-label="Dismiss">
              <X size={13} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
