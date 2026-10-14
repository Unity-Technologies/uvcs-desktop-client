import { CloudOff, KeyRound, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../ui/Button';
import { openDialog } from '../../ui/dialog/dialogStore';
import { IconButton } from '../../ui/IconButton';
import { CornerCard, CornerCardText } from '../../ui/toast/CornerCard';
import { useWorkspaceInfoOf } from '../workspace/useWorkspace';
import { useSession } from '../workspace/sessionStore';
import { ConnectionProblemDialog } from './ConnectionProblemDialog';
import { connectionProblemShown } from './connectionProblemShown';
import { connectionProblemWords } from './connectionProblemWords';
import { useCmAvailability, useConnectionCheck, useSetupCheck } from './useCmAvailability';

/**
 * The corner card of the open workspace's server out of reach, or wanting a sign-in, while the workspace keeps
 * working with what's local (`connectionProblemShown`). The check runs once the workspace's info names its server.
 */
export function ConnectionProblemCard() {
  const workspacePath = useSession((state) => state.workspacePath);
  const cm = useCmAvailability();
  const setup = useSetupCheck(cm.isSuccess);
  const { data: info } = useWorkspaceInfoOf(workspacePath);
  const check = useConnectionCheck(setup.data === null ? info?.server : undefined);
  const [dismissedServer, setDismissedServer] = useState<string | null>(null);
  const problem = connectionProblemShown(check.data, { workspaceOpen: workspacePath !== null, dismissedServer });
  if (!problem) return null;

  const { title, explanation } = connectionProblemWords(problem);
  const checking = check.isFetching;
  return (
    <CornerCard
      role="status"
      icon={problem.kind === 'notSignedIn' ? <KeyRound size={15} /> : <CloudOff size={15} />}
      title={title}
      trailing={<IconButton icon={<X size={13} />} label="Dismiss" size="small" onClick={() => setDismissedServer(problem.server)} />}
      actions={
        <>
          <Button variant="ghost" size="small" onClick={() => openDialog((close) => <ConnectionProblemDialog problem={problem} onClose={close} />)}>
            Details
          </Button>
          <Button
            variant="primary"
            size="small"
            icon={<RefreshCw size={13} className={checking ? 'spinning' : undefined} />}
            onClick={() => void check.refetch()}
            disabled={checking}
          >
            {checking ? 'Checking…' : 'Retry'}
          </Button>
        </>
      }
    >
      <CornerCardText>{explanation}</CornerCardText>
    </CornerCard>
  );
}
