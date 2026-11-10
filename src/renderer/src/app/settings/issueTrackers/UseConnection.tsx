import { useState } from 'react';
import type { SignInFailure } from '@shared/domain/issueTrackers';
import type { RecognizedLink } from '@shared/issueTrackers/trackerGrammar';
import { TRACKER_GRAMMARS } from '@shared/issueTrackers/trackerGrammars';
import { api } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { CheckedLine } from './CheckedLine';
import { connectFailureWords, hostOf, type SignInStep } from './connectFlow';
import { SignInProblem } from './SignInProblem';
import type { SignedIn } from './ConnectTracker';
import { DifferentAccountLink } from './DifferentAccountLink';
import styles from './IssueTrackerPane.module.css';

/**
 * Connecting the repository with a sign-in already there: one click, proven with the link's project. Once the sign-in
 * was picked in the first step, the link step already says whose it is, so this is Connect alone.
 */
export function UseConnection(props: {
  link: RecognizedLink;
  linkText: string;
  step: Extract<SignInStep, { kind: 'useConnection' }>;
  repository: string;
  picked: boolean;
  /** The sign-in's own failure, from the step before (a project it couldn't read), until Connect tries again. */
  failure: SignInFailure | null;
  onConnected: (outcome: SignedIn) => void;
  onDifferentAccount: () => void;
}) {
  const { link, linkText, step, repository, picked, onConnected, onDifferentAccount } = props;
  const [failure, setFailure] = useState<SignInFailure | null>(props.failure);
  const [busy, setBusy] = useState(false);
  const name = TRACKER_GRAMMARS[step.connection.kind].name;
  const connect = async (): Promise<void> => {
    setBusy(true);
    const outcome = await api.issueTrackers.useConnection({ repository, link: linkText, connectionId: step.connection.id });
    setBusy(false);
    if (outcome.kind === 'signedIn') onConnected(outcome);
    else setFailure(outcome.failure);
  };
  return (
    <div className={styles.next}>
      {!picked && (
        <>
          <p className={styles.nextTitle}>Next: connect with your {name} sign-in</p>
          <CheckedLine>
            Signed in as <strong>{step.connection.account.name}</strong> at {hostOf(step.connection.server)}
          </CheckedLine>
        </>
      )}
      <div className={styles.row}>
        <Button size="small" variant="primary" loading={busy} onClick={() => void connect()}>
          Connect
        </Button>
        <DifferentAccountLink onClick={onDifferentAccount} />
      </div>
      {failure && <SignInProblem failed={connectFailureWords(failure, { trackerName: name, server: link.server })} />}
    </div>
  );
}
