import { Download, RefreshCw, TerminalSquare } from 'lucide-react';
import { api } from '../../api/client';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import styles from './CmUnavailableScreen.module.css';

const DOWNLOAD_URL = 'https://unity.com/products/version-control/download';

export function CmUnavailableScreen({ reason, onRetry }: { reason: string; onRetry: () => void }) {
  return (
    <div className={styles.screen}>
      <div className={styles.dragRegion} />
      <EmptyState
        icon={<TerminalSquare size={24} />}
        title="The Unity Version Control CLI isn't available"
        description={
          <>
            This app works on top of the <code>cm</code> command line client. Install Unity Version Control, sign in once, and try
            again.
            <span className={`${styles.reason} selectable`}>{reason}</span>
          </>
        }
        action={
          <div className={styles.actions}>
            <Button icon={<RefreshCw size={14} />} onClick={onRetry}>
              Try again
            </Button>
            <Button variant="primary" icon={<Download size={14} />} onClick={() => void api.system.openExternal(DOWNLOAD_URL)}>
              Download
            </Button>
          </div>
        }
      />
    </div>
  );
}
