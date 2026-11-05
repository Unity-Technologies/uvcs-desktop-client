import { useState } from 'react';
import type { SignInFailure, SignInOutcome, TrackerConnection } from '@shared/domain/issueTrackers';
import { TRACKER_GRAMMARS } from '@shared/issueTrackers/trackerGrammars';
import { api } from '../../../api/client';
import { useIssueTrackerSetup } from '../../../components/issues/useIssueTrackers';
import { Button } from '../../../ui/Button';
import { connectFailureWords, signInAgainStep, type SignInAgainStep } from './connectFlow';
import { DeviceSignIn } from './DeviceSignIn';
import { TokenSignIn } from './TokenSignIn';
import styles from './IssueTrackerPane.module.css';

/**
 * A connection whose credential stopped working (docs/features/issue-trackers.md, "Credential state"): "Sign in again"
 * first tries the kept credential once more (`retrySignIn`). Only a credential the tracker refused asks for a new one,
 * by the server's best method (`signInAgainStep`); out of reach or rate limited, it stays and says why. The
 * repositories that use it keep it.
 */
export function SignInAgain({ connection, why }: { connection: TrackerConnection; why: string }) {
  const deviceFlowHosts = useIssueTrackerSetup()?.deviceFlowHosts ?? [];
  const [step, setStep] = useState<SignInAgainStep | null>(null);
  const [useToken, setUseToken] = useState(false);
  const [failure, setFailure] = useState<SignInFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const name = TRACKER_GRAMMARS[connection.kind].name;
  const finish = (outcome: SignInOutcome): void => {
    if (outcome.kind === 'failed') setFailure(outcome.failure);
  };
  const retry = async (): Promise<void> => {
    setBusy(true);
    const outcome = await api.issueTrackers.retrySignIn(connection.id);
    setBusy(false);
    if (outcome.kind === 'failed') setStep(signInAgainStep(connection, outcome.failure, deviceFlowHosts));
  };

  if (step?.kind === 'askCredential') {
    const target = { connectionId: connection.id };
    return (
      <div className={styles.step}>
        <p className={styles.problem}>{why}</p>
        {step.methods[0] === 'deviceCode' && !useToken ? (
          <>
            <DeviceSignIn request={target} trackerName={name} onOutcome={finish} onUseToken={() => setUseToken(true)} />
            {failure && <p className={styles.problem}>{connectFailureWords(failure, { trackerName: name, server: connection.server }).words}</p>}
          </>
        ) : (
          <TokenSignIn
            kind={connection.kind}
            server={connection.server}
            pageTarget={target}
            failure={failure}
            onOutcome={finish}
            {...(connection.account.email && { keptEmail: connection.account.email })}
            signIn={(source, email) => api.issueTrackers.signInAgain({ connectionId: connection.id, source, ...(email && { email }) })}
          />
        )}
      </div>
    );
  }
  return (
    <div className={styles.step}>
      <p className={styles.problem}>{step?.kind === 'problem' ? step.words : why}</p>
      <div className={styles.row}>
        <Button size="small" variant="primary" loading={busy} onClick={() => void retry()}>
          {step ? 'Try again' : 'Sign in again'}
        </Button>
      </div>
    </div>
  );
}
