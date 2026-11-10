import { useState } from 'react';
import type { SignInFailure, SignInOutcome } from '@shared/domain/issueTrackers';
import type { RecognizedLink } from '@shared/issueTrackers/trackerGrammar';
import { TRACKER_GRAMMARS } from '@shared/issueTrackers/trackerGrammars';
import { api } from '../../../api/client';
import { CheckedLine } from './CheckedLine';
import { connectFailureWords, hostOf, signInForView, type SignInStep } from './connectFlow';
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
  const finish = (outcome: SignInOutcome): void => {
    if (outcome.kind === 'signedIn') onConnected(outcome);
    else setFailure(outcome.failure);
  };

  const view = signInForView(step, repository, tokenChosen, failure);
  const problem = view.failure && <SignInProblem failed={connectFailureWords(view.failure, { trackerName: TRACKER_GRAMMARS[link.kind].name, server: link.server })} />;
  switch (view.kind) {
    case 'useConnection':
      return <UseConnection link={link} linkText={linkText} step={view.step} repository={view.repository} picked={picked} failure={view.failure} onConnected={onConnected} onDifferentAccount={onDifferentAccount} />;
    case 'alreadySignedIn':
      return (
        <div className={styles.next}>
          <p className={styles.nextTitle}>You're already signed in</p>
          <CheckedLine>
            Signed in as <strong>{view.step.connection.account.name}</strong> at {hostOf(view.step.connection.server)}
          </CheckedLine>
          <DifferentAccountLink onClick={onDifferentAccount} />
          {problem}
        </div>
      );
    case 'signIn':
      return (
        <div className={styles.next}>
          {view.step.replacesWords && <p className={styles.note}>{view.step.replacesWords}</p>}
          {view.method === 'deviceCode' && <p className={styles.intro}>So the app can show each issue’s title and status. It only reads.</p>}
          {view.method === 'deviceCode' ? (
            <DeviceSignIn request={{ ...(repository && { repository }), link: linkText }} trackerName={view.step.trackerName} onOutcome={finish} onUseToken={() => setTokenChosen(true)} />
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
          {problem}
        </div>
      );
  }
}
