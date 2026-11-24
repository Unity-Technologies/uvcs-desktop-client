import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client';
import { AppMark } from '../../components/AppMark';
import { Button } from '../../ui/Button';
import { useTheme } from '../settings/useTheme';
import { FoldedOutput } from '../../ui/FoldedOutput';
import { cmSetupViewOf, installedCmLabel, type CmSetupView as View } from './cmSetupView';
import { useCmRuntimeStore, useSecondsLeft } from './cmRuntimeStore';
import { CmUpdateNeeded } from './CmUpdateNeeded';
import { useRetryWhenOnline } from './useRetryWhenOnline';
import styles from './CmSetupScreen.module.css';

/**
 * The whole window while the app sets up its own Unity Version Control: on the first run, and when an update brought a
 * newer one it couldn't download ahead (docs/features/cm-runtime.md "The setup screen"). It asks nothing of the user;
 * the app's screens follow by themselves once it's done. It also asks to update the installed one when it's older than
 * the app needs (`CmUpdateNeeded`).
 */
export function CmSetupScreen() {
  // Root applies the theme once the app shows; until then, this screen does.
  useTheme();
  const status = useCmRuntimeStore((state) => state.status);
  const view = cmSetupViewOf(status, useSecondsLeft());
  useRetryWhenOnline(status);
  const body = status.kind === 'installedTooOld' ? <CmUpdateNeeded status={status} /> : view && (view.kind === 'progress' ? <Progress view={view} /> : <Failure view={view} />);
  if (!body) return null;
  return (
    <div className={styles.screen}>
      <div className={styles.dragRegion} />
      <main className={styles.column}>
        <AppMark size={56} />
        {body}
      </main>
    </div>
  );
}

function Progress({ view }: { view: Extract<View, { kind: 'progress' }> }) {
  const percent = view.fraction === null ? undefined : Math.round(view.fraction * 100);
  return (
    <div className={styles.delayed}>
      <h1 className={styles.title}>{view.title}</h1>
      <p className={styles.subtitle}>{view.subtitle}</p>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={view.title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        data-indeterminate={view.fraction === null || undefined}
        data-finishing={view.finishing || undefined}
      >
        <div className={styles.fill} style={{ width: `${(view.fraction ?? 0) * 100}%` }} />
      </div>
      <p className={styles.detail} aria-live="polite">
        {view.detail ?? ' '}
      </p>
    </div>
  );
}

function Failure({ view }: { view: Extract<View, { kind: 'failed' }> }) {
  const [retrying, setRetrying] = useState(false);
  const retry = async (): Promise<void> => {
    setRetrying(true);
    try {
      await api.cmRuntime.retry();
    } finally {
      setRetrying(false);
    }
  };
  return (
    <div className={styles.failure}>
      <h1 className={styles.title}>{view.title}</h1>
      <p className={styles.reason}>{view.reason}</p>
      <div className={styles.actions}>
        <Button variant="primary" icon={<RefreshCw size={14} className={retrying ? 'spinning' : undefined} />} onClick={() => void retry()} disabled={retrying}>
          Try Again
        </Button>
        {view.installedCm && <Button onClick={() => void api.cmRuntime.use('automatic')}>{installedCmLabel(view.installedCm)}</Button>}
      </div>
      <div className={styles.details}>
        <FoldedOutput output={view.detail} />
      </div>
    </div>
  );
}
