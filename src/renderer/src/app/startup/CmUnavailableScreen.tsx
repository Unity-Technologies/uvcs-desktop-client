import { Download, RefreshCw, TerminalSquare } from 'lucide-react';
import type { CmRuntimeStatus } from '@shared/domain/cmRuntime';
import { api } from '../../api/client';
import { Button } from '../../ui/Button';
import { FoldedOutput } from '../../ui/FoldedOutput';
import { ScreenMessage } from '../../ui/ScreenMessage';
import { CopyableCommand } from './CopyableCommand';
import { cmUnavailableView } from './cmUnavailableView';
import { DOWNLOAD_URL, installGuidance } from './installGuidance';
import styles from './CmUnavailableScreen.module.css';

interface CmUnavailableScreenProps {
  reason: string;
  /** Which `cm` didn't start: the app's own, or one installed. */
  /** Which `cm` didn't start, and the versions when it's an installed one too old to run. */
  cm: Pick<Extract<CmRuntimeStatus, { kind: 'ready' }>, 'source' | 'installedTooOld'>;
  /** True while re-checking. */
  checking: boolean;
  onRecheck: () => void;
}

/** Shown when the `cm` command line client can't be run; re-checks without restarting the app. */
export function CmUnavailableScreen({ reason, cm, checking, onRecheck }: CmUnavailableScreenProps) {
  const guidance = installGuidance(window.uvcs.platform);
  const view = cmUnavailableView(cm, checking);

  return (
    <ScreenMessage
      icon={<TerminalSquare size={26} />}
      tone="warning"
      title={view.title}
      actions={
        <>
          {view.offersInstall && (
            <Button variant="primary" icon={<Download size={14} />} onClick={() => void api.system.openExternal(DOWNLOAD_URL)}>
              {guidance.downloadLabel}
            </Button>
          )}
          <Button icon={<RefreshCw size={14} className={checking ? 'spinning' : undefined} />} onClick={onRecheck} disabled={checking}>
            {view.checkAgainLabel}
          </Button>
        </>
      }
      footer={
        <>
          {view.offersInstall && <CopyableCommand note={guidance.commandNote} command={guidance.command} />}
          <FoldedOutput output={reason} />
        </>
      }
    >
      <p>{view.body}</p>
      {view.versions && <p className={styles.versions}>{view.versions}</p>}
    </ScreenMessage>
  );
}
