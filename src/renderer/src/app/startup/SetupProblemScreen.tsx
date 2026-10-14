import { Download, RefreshCw, Settings2 } from 'lucide-react';
import type { SetupProblem } from '@shared/domain/setup';
import { api } from '../../api/client';
import { Button } from '../../ui/Button';
import { OutputBlock } from '../../ui/OutputBlock';
import { ScreenMessage } from '../../ui/ScreenMessage';
import { CopyableCommand } from './CopyableCommand';
import { DOWNLOAD_URL } from './installGuidance';

interface SetupProblemScreenProps {
  problem: SetupProblem;
  checking: boolean;
  onRetry: () => void;
}

/**
 * Explains that `cm` has no configuration yet, instead of a trail of failing views: it can't work with any server, so
 * this takes the app's place (`Root` in `App.tsx`, on `useSetupCheck`).
 */
export function SetupProblemScreen({ problem, checking, onRetry }: SetupProblemScreenProps) {
  return (
    <ScreenMessage
      icon={<Settings2 size={26} />}
      tone="warning"
      title="Unity Version Control isn't set up yet"
      actions={
        <>
          <Button
            variant="primary"
            icon={<RefreshCw size={14} className={checking ? 'spinning' : undefined} />}
            onClick={onRetry}
            disabled={checking}
          >
            {checking ? 'Checking…' : 'Retry'}
          </Button>
          <Button icon={<Download size={14} />} onClick={() => void api.system.openExternal(DOWNLOAD_URL)}>
            Get the Unity Version Control app
          </Button>
        </>
      }
      footer={
        <>
          <CopyableCommand note="Or set it up in a terminal:" command="cm configure" />
          <OutputBlock output={`$ ${problem.commandLine}\n${problem.output}`} />
        </>
      }
    >
      <p>
        Unity Version Control needs to know who you are before it can work with a server. Sign in once with the Unity Version Control app, or set it
        up in a terminal, then retry.
      </p>
    </ScreenMessage>
  );
}
