import { Download, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PLATFORM } from '../../lib/platform';
import { Button } from '../../ui/Button';
import { FoldedOutput } from '../../ui/FoldedOutput';
import { CopyableCommand } from '../startup/CopyableCommand';
import { useCmRuntimeStore } from './cmRuntimeStore';
import { cmUpdateViewOf, type CmTooOld, type CmUpdateCheck, type CmUpdateView } from './cmUpdateView';
import styles from './CmSetupScreen.module.css';

/** Linux has no installer to run: the screen shows the command that updates it. */
const CAN_INSTALL = PLATFORM !== 'linux';

/**
 * The setup screen's body when the installed Unity Version Control is older than the app needs
 * (docs/features/cm-runtime.md "The update screen"): Update, which runs its installer (downloaded in the background as
 * the screen shows), or the app's own for now. It also checks the installed one again as the window gains focus (the
 * user may come back from updating it).
 */
export function CmUpdateNeeded({ status }: { status: CmTooOld }) {
  const [check, setCheck] = useState<CmUpdateCheck>('none');
  const view = cmUpdateViewOf(status, check, CAN_INSTALL);
  const waitsForUser = view.kind === 'offer' || view.kind === 'byCommand';
  useEffect(() => {
    // The installer downloads while the user reads; joined in main when several windows ask.
    void api.cmRuntime.prepareUpdate();
  }, []);
  useEffect(() => {
    if (!waitsForUser) return;
    // Quietly: the screen moves on by itself once it's new enough.
    const checkAgain = (): void => void api.cmRuntime.checkInstalledAgain();
    window.addEventListener('focus', checkAgain);
    return () => window.removeEventListener('focus', checkAgain);
  }, [waitsForUser]);
  const checkAgain = async (): Promise<void> => {
    setCheck('checking');
    try {
      await api.cmRuntime.checkInstalledAgain();
    } finally {
      setCheck(useCmRuntimeStore.getState().status.kind === 'installedTooOld' ? 'stillTooOld' : 'none');
    }
  };
  return (
    <div className={styles.failure}>
      <h1 className={styles.title}>{view.title}</h1>
      <p className={styles.reason} aria-live="polite">
        {view.body}
      </p>
      <p className={styles.versions}>{view.versions}</p>
      <UpdateBody view={view} onCheckAgain={() => void checkAgain()} />
    </div>
  );
}

function UpdateBody({ view, onCheckAgain }: { view: CmUpdateView; onCheckAgain: () => void }) {
  const update = (): void => void api.cmRuntime.updateInstalled();
  const useIncluded = (): void => void api.cmRuntime.useIncludedForNow();
  switch (view.kind) {
    case 'offer':
      return (
        <>
          <p className={styles.reason}>{view.hint}</p>
          <div className={styles.actions}>
            <Button variant="primary" icon={<Download size={14} />} onClick={update}>
              {view.updateLabel}
            </Button>
            <Button onClick={useIncluded}>{view.includedLabel}</Button>
          </div>
          <p className={styles.detail} aria-live="polite">
            {view.background ?? ' '}
          </p>
          <FoldedDetails detail={view.detail} />
        </>
      );
    case 'updating':
      return <UpdateProgress fraction={view.fraction} progress={view.progress} label={view.title} />;
    case 'failed':
      return (
        <>
          <p className={styles.reason}>{view.hint}</p>
          <div className={styles.actions}>
            <Button variant="primary" icon={<RefreshCw size={14} />} onClick={update}>
              {view.tryAgainLabel}
            </Button>
            <Button onClick={useIncluded}>{view.includedLabel}</Button>
          </div>
          <FoldedDetails detail={view.detail} />
        </>
      );
    case 'byCommand':
      return (
        <>
          <p className={styles.reason}>{view.hint}</p>
          {view.command && (
            <div className={styles.details}>
              <CopyableCommand note={view.commandNote} command={view.command} />
            </div>
          )}
          <div className={styles.actions}>
            <Button variant="primary" onClick={useIncluded}>
              {view.includedLabel}
            </Button>
            <Button icon={<RefreshCw size={14} className={view.checking ? 'spinning' : undefined} />} onClick={onCheckAgain} disabled={view.checking}>
              {view.checkAgainLabel}
            </Button>
          </div>
          <FoldedDetails detail={view.detail} />
        </>
      );
  }
}

/** The bar while the update downloads (measured), then while the installer runs (a light running along it). */
function UpdateProgress({ fraction, progress, label }: { fraction: number | null; progress: string | null; label: string }) {
  const percent = fraction === null ? undefined : Math.round(fraction * 100);
  return (
    <>
      <div className={styles.track} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} data-indeterminate={fraction === null || undefined}>
        <div className={styles.fill} style={{ width: `${(fraction ?? 0) * 100}%` }} />
      </div>
      <p className={styles.detail}>{progress ?? ' '}</p>
    </>
  );
}

function FoldedDetails({ detail }: { detail: string }) {
  return (
    <div className={styles.details}>
      <FoldedOutput output={detail} />
    </div>
  );
}
