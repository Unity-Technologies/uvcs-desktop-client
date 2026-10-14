import { CloudOff, KeyRound, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../ui/Button';
import { openDialog } from '../../ui/dialog/dialogStore';
import { IconButton } from '../../ui/IconButton';
import { CornerCard, CornerCardText } from '../../ui/toast/CornerCard';
import { serverProblemWords } from './serverProblemWords';
import { SetupProblemDialog } from './SetupProblemDialog';
import { setupProblemShown } from './setupProblemShown';
import { useCmAvailability, useSetupCheck } from './useCmAvailability';

/** The corner card of a server out of reach or a failed sign-in, while the app keeps working (`setupProblemShown`). */
export function SetupProblemCard() {
  const cm = useCmAvailability();
  const setup = useSetupCheck(cm.isSuccess);
  const [dismissed, setDismissed] = useState(false);
  const problem = setup.data;
  if (!problem || setupProblemShown(problem, { cardDismissed: dismissed }) !== 'card') return null;

  const { title, explanation } = serverProblemWords(problem);
  const checking = setup.isFetching;
  return (
    <CornerCard
      role="status"
      icon={problem.kind === 'notSignedIn' ? <KeyRound size={15} /> : <CloudOff size={15} />}
      title={title}
      trailing={<IconButton icon={<X size={13} />} label="Dismiss" size="small" onClick={() => setDismissed(true)} />}
      actions={
        <>
          <Button variant="ghost" size="small" onClick={() => openDialog((close) => <SetupProblemDialog problem={problem} onClose={close} />)}>
            Details
          </Button>
          <Button
            variant="primary"
            size="small"
            icon={<RefreshCw size={13} className={checking ? 'spinning' : undefined} />}
            onClick={() => void setup.refetch()}
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
