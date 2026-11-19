import { Download, RefreshCw, TerminalSquare } from 'lucide-react';
import type { CmSource } from '@shared/domain/cmRuntime';
import { api } from '../../api/client';
import { Button } from '../../ui/Button';
import { OutputBlock } from '../../ui/OutputBlock';
import { ScreenMessage } from '../../ui/ScreenMessage';
import { CopyableCommand } from './CopyableCommand';
import { cmUnavailableView } from './cmUnavailableView';
import { DOWNLOAD_URL, installGuidance } from './installGuidance';

interface CmUnavailableScreenProps {
  reason: string;
  /** Which `cm` didn't start: the app's own, or one installed. */
  source: CmSource;
  /** True while re-checking. */
  checking: boolean;
  onRecheck: () => void;
}

/** Shown when the `cm` command line client can't be run; re-checks without restarting the app. */
export function CmUnavailableScreen({ reason, source, checking, onRecheck }: CmUnavailableScreenProps) {
  const guidance = installGuidance(window.uvcs.platform);
  const view = cmUnavailableView(source);

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
            {checking ? 'Checking…' : 'Check Again'}
          </Button>
        </>
      }
      footer={
        <>
          {view.offersInstall && <CopyableCommand note={guidance.commandNote} command={guidance.command} />}
          <OutputBlock output={reason} />
        </>
      }
    >
      <p>{view.body}</p>
    </ScreenMessage>
  );
}
