import { Download, RefreshCw, TerminalSquare } from 'lucide-react';
import { api } from '../../api/client';
import { Button } from '../../ui/Button';
import { OutputBlock } from '../../ui/OutputBlock';
import { ScreenMessage } from '../../ui/ScreenMessage';
import { CopyableCommand } from './CopyableCommand';
import { DOWNLOAD_URL, installGuidance } from './installGuidance';

interface CmUnavailableScreenProps {
  reason: string;
  /** True while re-checking. */
  checking: boolean;
  onRecheck: () => void;
}

/** Shown when the `cm` command line client can't be run; re-checks without restarting the app. */
export function CmUnavailableScreen({ reason, checking, onRecheck }: CmUnavailableScreenProps) {
  const guidance = installGuidance(window.uvcs.platform);

  return (
    <ScreenMessage
      icon={<TerminalSquare size={26} />}
      tone="warning"
      title="Unity Version Control is required"
      actions={
        <>
          <Button variant="primary" icon={<Download size={14} />} onClick={() => void api.system.openExternal(DOWNLOAD_URL)}>
            {guidance.downloadLabel}
          </Button>
          <Button icon={<RefreshCw size={14} className={checking ? 'spinning' : undefined} />} onClick={onRecheck} disabled={checking}>
            {checking ? 'Checking…' : 'Re-check'}
          </Button>
        </>
      }
      footer={
        <>
          <CopyableCommand note={guidance.commandNote} command={guidance.command} />
          <OutputBlock output={reason} />
        </>
      }
    >
      <p>
        This app works through <code>cm</code>, the Unity Version Control command line client, and it isn't installed (or isn't on your
        PATH) yet. Install it, then re-check: no restart needed.
      </p>
    </ScreenMessage>
  );
}
