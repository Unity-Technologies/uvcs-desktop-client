import { Check, Info, X } from 'lucide-react';
import type { ProgressStep } from '@shared/domain/operation';
import { PathLabel } from '../../components/PathLabel';
import { ProgressRing } from '../../ui/ProgressRing';
import { AUTO_DISMISS_MS, type Toast } from '../../ui/toast/toastStore';
import { describeProgress, itemInWorkspace } from './describeProgress';
import { ringValue, SWEEP } from './progressBar';
import { ProgressTrack } from './ProgressTrack';
import { useOperation } from './runningOperationsStore';
import styles from './OperationCard.module.css';

interface OperationCardProps {
  toast: Toast;
  dismiss: () => void;
}

/**
 * A long operation, as it runs: its title, a stable stage line ("Downloading 124 of 530 files", "43%"), a bar gliding
 * between reports, and the bytes (or the file being worked on) with the time left when it can tell. Every line keeps
 * its place and width, so nothing jumps while numbers change. When it's done the card says so in place, and its bar,
 * turned green, runs out as the countdown to its leaving (hovering holds it).
 */
export function OperationCard({ toast, dismiss }: OperationCardProps) {
  const operation = useOperation(toast.operationId);
  const done = toast.kind !== 'progress';
  const progress = operation?.progress ?? null;
  const bar = operation?.bar ?? SWEEP;
  const text = describeProgress(progress);
  const item = !text.amount && progress?.currentItem && operation ? itemInWorkspace(progress.currentItem, operation.workspacePath) : null;
  const stoppable = progress?.cancellable !== false;

  return (
    <div className={styles.card} data-state={done ? toast.kind : 'running'} role="status">
      <div className={styles.header}>
        <span className={styles.icon}>
          {done ? (
            <span className={styles.doneIcon}>{toast.kind === 'info' ? <Info size={12} strokeWidth={2.5} /> : <Check size={12} strokeWidth={3} />}</span>
          ) : (
            <ProgressRing value={ringValue(bar)} size={16} />
          )}
        </span>
        <span className={styles.title}>{toast.title}</span>
        {!done && progress?.step && <StepPips step={progress.step} />}
        {toast.action && (
          <button
            className={styles.action}
            disabled={toast.action.disabled || (!done && !stoppable)}
            data-tip={!done && !stoppable ? "It can't be stopped now without leaving the workspace halfway" : undefined}
            onClick={() => {
              toast.action!.run();
              if (done) dismiss();
            }}
          >
            {toast.action.label}
          </button>
        )}
        {done && (
          <button className={styles.close} onClick={dismiss} aria-label="Dismiss">
            <X size={13} />
          </button>
        )}
      </div>

      <div className={styles.stageRow}>
        <span className={`${styles.stage} ${done ? 'selectable' : ''}`}>{done ? toast.detail : text.stage}</span>
        {!done && <span className={styles.percent}>{bar.mode === 'sweep' ? null : text.percent}</span>}
      </div>

      <ProgressTrack
        className={styles.track}
        bar={bar}
        countdownMs={done ? (AUTO_DISMISS_MS[toast.kind] ?? undefined) : undefined}
        onCountdownEnd={dismiss}
      />

      {/* Kept when done, empty, so the card doesn't shrink under the pointer as it finishes. */}
      <div className={styles.metaRow}>
        {!done && (
          <>
            <span className={styles.amount}>{text.amount ?? (item && <PathLabel path={item} tooltip={false} />)}</span>
            <span className={styles.remaining}>{bar.remaining}</span>
          </>
        )}
      </div>
    </div>
  );
}

/** Where an operation made of several commands is: one pip per step, the current one lit. */
function StepPips({ step }: { step: ProgressStep }) {
  return (
    <span className={styles.steps} aria-label={`Step ${step.index} of ${step.count}: ${step.label}`} data-tip={`Step ${step.index} of ${step.count}`}>
      {Array.from({ length: step.count }, (_, index) => (
        <span key={index} className={styles.pip} data-state={index + 1 < step.index ? 'done' : index + 1 === step.index ? 'current' : 'pending'} />
      ))}
    </span>
  );
}
