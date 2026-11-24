import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Button } from '../../ui/Button';
import { FoldedOutput } from '../../ui/FoldedOutput';
import { useCmRuntimeStore } from './cmRuntimeStore';
import { cmUpdateViewOf, type CmTooOld, type CmUpdateCheck } from './cmUpdateView';
import styles from './CmSetupScreen.module.css';

/**
 * The setup screen's body when the installed Unity Version Control is older than the app needs
 * (docs/features/cm-runtime.md "The update screen"): Check Again, also asked as the window gains focus (the user may
 * come back from updating it), and running the app's own for now.
 */
export function CmUpdateNeeded({ status }: { status: CmTooOld }) {
  const [check, setCheck] = useState<CmUpdateCheck>('none');
  const view = cmUpdateViewOf(status, check);
  useEffect(() => {
    // Quietly: the screen moves on by itself once it's new enough.
    const checkAgain = (): void => void api.cmRuntime.checkInstalledAgain();
    window.addEventListener('focus', checkAgain);
    return () => window.removeEventListener('focus', checkAgain);
  }, []);
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
      <p className={styles.reason}>{view.body}</p>
      <p className={styles.reason} aria-live="polite">
        {view.hint}
      </p>
      <div className={styles.actions}>
        <Button variant="primary" onClick={() => void api.cmRuntime.useIncludedForNow()}>
          {view.includedLabel}
        </Button>
        <Button icon={<RefreshCw size={14} className={view.checking ? 'spinning' : undefined} />} onClick={() => void checkAgain()} disabled={view.checking}>
          {view.checkAgainLabel}
        </Button>
      </div>
      <div className={styles.details}>
        <FoldedOutput output={view.detail} />
      </div>
    </div>
  );
}
