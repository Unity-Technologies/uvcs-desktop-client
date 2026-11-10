import { useState } from 'react';
import type { SignInFailure, SignInOutcome } from '@shared/domain/issueTrackers';
import type { RecognizedLink } from '@shared/issueTrackers/trackerGrammar';
import { api } from '../../../api/client';
import { CheckedLine } from './CheckedLine';
import { connectFailureWords, hostOf, signInMethodShown, type SignInStep } from './connectFlow';
import { SignInProblem } from './SignInProblem';
import type { SignedIn } from './ConnectTracker';
import { DeviceSignIn } from './DeviceSignIn';
import { DifferentAccountLink } from './DifferentAccountLink';
import { TokenSignIn } from './TokenSignIn';
import { UseConnection } from './UseConnection';
import styles from './IssueTrackerPane.module.css';

interface SignInForProps {
  link: RecognizedLink;
  linkText: string;
  step: SignInStep;
  repository: string | undefined;
  /** The sign-in covering the link was picked in the first step, and the link step already says so. */
  picked: boolean;
  onConnected: (outcome: SignedIn) => void;
  /** "Use a different account" over the sign-in already there. */
  onDifferentAccount: () => void;
}

/** The sign-in step for a link read back: a sign-in already there in one click, else the tracker's best method. */
export function SignInFor({ link, linkText, step, repository, picked, onConnected, onDifferentAccount }: SignInForProps) {
  const [failure, setFailure] = useState<SignInFailure | null>(null);
  const [tokenChosen, setTokenChosen] = useState(false);
  const method = step.kind === 'signIn' ? signInMethodShown(step.methods, tokenChosen) : 'token';
  const finish = (outcome: SignInOutcome): void => {
    if (outcome.kind === 'signedIn') onConnected(outcome);
    else setFailure(outcome.failure);
  };

  if (step.kind === 'useConnection') {
    if (repository) return <UseConnection link={link} linkText={linkText} step={step} repository={repository} picked={picked} onConnected={onConnected} onDifferentAccount={onDifferentAccount} />;
    return (
      <div className={styles.next}>
        <p className={styles.nextTitle}>You're already signed in</p>
        <CheckedLine>
          Signed in as <strong>{step.connection.account.name}</strong> at {hostOf(step.connection.server)}
        </CheckedLine>
        <DifferentAccountLink onClick={onDifferentAccount} />
      </div>
    );
  }
  return (
    <div className={styles.next}>
      {step.replacesWords && <p className={styles.note}>{step.replacesWords}</p>}
      {method === 'deviceCode' && <p className={styles.intro}>So the app can show each issue’s title and status. It only reads.</p>}
      {method === 'deviceCode' ? (
        <DeviceSignIn request={{ ...(repository && { repository }), link: linkText }} trackerName={step.trackerName} onOutcome={finish} onUseToken={() => setTokenChosen(true)} />
      ) : (
        <TokenSignIn
          kind={link.kind}
          server={link.server}
          pageTarget={{ link: linkText }}
          failure={failure}
          onOutcome={finish}
          signIn={(token, email) => api.issueTrackers.signInWithToken({ ...(repository && { repository }), link: linkText, token, ...(email && { email }) })}
        />
      )}
      {method === 'deviceCode' && failure && <SignInProblem failed={connectFailureWords(failure, { trackerName: step.trackerName, server: link.server })} />}
    </div>
  );
}
