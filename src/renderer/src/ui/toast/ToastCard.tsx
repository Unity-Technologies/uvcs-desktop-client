import { AlertCircle, Check, CheckCircle2, Copy, Info, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Spinner } from '../Spinner';
import { useCopiedFeedback } from '../useCopiedFeedback';
import { autoDismissMsOf, detailToggleOf, errorCopyTextOf } from './toastDetail';
import type { Toast, ToastAction, ToastKind } from './toastStore';
import { useClippedText } from './useClippedText';
import styles from './Toast.module.css';

const ICONS: Record<ToastKind, React.ReactNode> = {
  info: <Info size={16} className={styles.infoIcon} />,
  success: <CheckCircle2 size={16} className={styles.successIcon} />,
  error: <AlertCircle size={16} className={styles.errorIcon} />,
  progress: <Spinner size={14} />,
};

interface ToastCardProps {
  toast: Toast;
  action: ToastAction | undefined;
  dismiss: () => void;
}

/** One toast: its title, its detail folded to a few lines (`toastDetail`), and its action under them. */
export function ToastCard({ toast, action, dismiss }: ToastCardProps) {
  const detailRef = useRef<HTMLDivElement>(null);
  const [unfolded, setUnfolded] = useState(false);
  const clipped = useClippedText(detailRef, !unfolded, toast.detail);
  const toggle = detailToggleOf(clipped, unfolded);
  const autoDismissMs = autoDismissMsOf(toast.kind, unfolded);
  const copyText = errorCopyTextOf(toast);
  const { copied, copy } = useCopiedFeedback();

  // Failures interrupt; the rest, operation progress included, wait for a pause.
  return (
    <div className={styles.toast} data-kind={toast.kind} role={toast.kind === 'error' ? 'alert' : 'status'}>
      <span className={styles.icon}>{ICONS[toast.kind]}</span>
      <div className={styles.text}>
        <div className={styles.title}>{toast.title}</div>
        {/* A running operation's detail changes with every line of progress: too chatty to be read out. */}
        {toast.detail && (
          <div
            ref={detailRef}
            className={`${styles.detail} selectable`}
            data-unfolded={unfolded || undefined}
            aria-live={toast.kind === 'progress' ? 'off' : undefined}
          >
            {toast.detail}
          </div>
        )}
        {(toggle || copyText || action) && (
          <div className={styles.footer}>
            {toggle && (
              <button className={styles.toggle} aria-expanded={unfolded} onClick={() => setUnfolded(!unfolded)}>
                {toggle}
              </button>
            )}
            {copyText && (
              <button className={styles.copy} onClick={() => copy(copyText)}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
            {action && (
              <button
                className={styles.action}
                disabled={action.disabled}
                onClick={() => {
                  action.run();
                  if (toast.kind !== 'progress') dismiss();
                }}
              >
                {action.label}
              </button>
            )}
          </div>
        )}
      </div>
      {toast.kind !== 'progress' && (
        <button className={styles.close} onClick={dismiss} aria-label="Dismiss">
          <X size={13} />
        </button>
      )}
      {/* The bar is the timer: dismissal fires when it runs out, so the two can't drift apart. Keyed on the kind so a
        finished progress toast starts its countdown fresh; folding the detail again starts it fresh too. */}
      {autoDismissMs !== null && (
        <span
          key={toast.kind}
          className={styles.countdown}
          style={{ animationDuration: `${autoDismissMs}ms` }}
          onAnimationEnd={dismiss}
        />
      )}
    </div>
  );
}
