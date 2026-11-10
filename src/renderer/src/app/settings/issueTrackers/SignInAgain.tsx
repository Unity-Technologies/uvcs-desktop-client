import { useState } from 'react';
import type { SignInFailure, SignInOutcome, TrackerConnection } from '@shared/domain/issueTrackers';
import { TRACKER_GRAMMARS } from '@shared/issueTrackers/trackerGrammars';
import { api } from '../../../api/client';
import { useIssueTrackerSetup } from '../../../components/issues/useIssueTrackers';
import { Button } from '../../../ui/Button';
import { connectFailureWords, signInAgainStep, signInAgainView, type SignInAgainStep } from './connectFlow';
import { SignInProblem } from './SignInProblem';
import { DeviceSignIn } from './DeviceSignIn';
import { TokenSignIn } from './TokenSignIn';
import styles from './IssueTrackerPane.module.css';

/**
 * A connection whose credential stopped working (docs/features/issue-trackers.md, "Credential state"): "Sign in again"
 * first tries the kept credential once more (`retrySignIn`). Only a credential the tracker refused asks for a new one,
 * by the server's best method; out of reach or rate limited, it stays and says why (`signInAgainView`). The
 * repositories that use it keep it.
 */
export function SignInAgain({ connection, why }: { connection: TrackerConnection; why: string }) {
  const deviceFlowHosts = useIssueTrackerSetup()?.deviceFlowHosts ?? [];
  const [step, setStep] = useState<SignInAgainStep | null>(null);
  const [tokenChosen, setTokenChosen] = useState(false);
  const [failure, setFailure] = useState<SignInFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const name = TRACKER_GRAMMARS[connection.kind].name;
  const view = signInAgainView(step, why, tokenChosen);
  const target = { connectionId: connection.id };
  const finish = (outcome: SignInOutcome): void => {
    if (outcome.kind === 'failed') setFailure(outcome.failure);
  };
  const retry = async (): Promise<void> => {
    setBusy(true);
    const outcome = await api.issueTrackers.retrySignIn(connection.id);
    setBusy(false);
    if (outcome.kind === 'failed') setStep(signInAgainStep(connection, outcome.failure, deviceFlowHosts));
  };

  switch (view.kind) {
    case 'retry':
      return (
        <div className={styles.next}>
          <p className={styles.calloutTitle}>{view.words}</p>
          <p className={styles.intro}>Issues show as plain links until you do.</p>
          <div className={styles.row}>
            <Button size="small" variant="primary" loading={busy} onClick={() => void retry()}>
              {view.button}
            </Button>
          </div>
        </div>
      );
    case 'deviceCode':
      return (
        <div className={styles.next}>
          <p className={styles.calloutTitle}>{why}</p>
          <DeviceSignIn request={target} trackerName={name} onOutcome={finish} onUseToken={() => setTokenChosen(true)} />
          {failure && <SignInProblem failed={connectFailureWords(failure, { trackerName: name, server: connection.server })} />}
        </div>
      );
    case 'token':
      return (
        <div className={styles.next}>
          <p className={styles.calloutTitle}>{why}</p>
          <TokenSignIn
            kind={connection.kind}
            server={connection.server}
            pageTarget={target}
            failure={failure}
            onOutcome={finish}
            {...(connection.account.email && { keptEmail: connection.account.email })}
            signIn={(token, email) => api.issueTrackers.signInAgain({ connectionId: connection.id, token, ...(email && { email }) })}
          />
        </div>
      );
  }
}
