import { useState } from 'react';
import type { SignInFailure, SignInOutcome, TrackerConnection } from '@shared/domain/issueTrackers';
import { TRACKER_GRAMMARS } from '@shared/issueTrackers/trackerGrammars';
import { api } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { TokenSignIn } from './TokenSignIn';
import styles from './IssueTrackerPane.module.css';

/**
 * A connection whose credential stopped working (docs/features/issue-trackers.md, "Credential state"): "Sign in again"
 * first tries the kept credential once more (`retrySignIn`), and asks for a new token only if that's refused too. The
 * repositories that use it keep it.
 */
export function SignInAgain({ connection, why }: { connection: TrackerConnection; why: string }) {
  const [askingToken, setAskingToken] = useState(false);
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
    if (outcome.kind === 'failed') setAskingToken(true);
  };

  return (
    <div className={styles.step}>
      <p className={styles.problem}>{why}</p>
      {askingToken ? (
        <TokenSignIn
          request={{ repository: '', link: connection.server }}
          link={connection}
          trackerName={name}
          needsEmail={connection.kind === 'jiraCloud'}
          failure={failure}
          onOutcome={finish}
          {...(connection.account.email && { keptEmail: connection.account.email })}
          signIn={(source, email) => api.issueTrackers.signInAgain({ connectionId: connection.id, source, ...(email && { email }) })}
        />
      ) : (
        <div className={styles.row}>
          <Button size="small" variant="primary" loading={busy} onClick={() => void retry()}>
            Sign in again
          </Button>
        </div>
      )}
    </div>
  );
}
