import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import type { SignInFailure, SignInOutcome } from '@shared/domain/issueTrackers';
import type { RecognizedLink } from '@shared/issueTrackers/trackerGrammar';
import { TRACKER_GRAMMARS } from '@shared/issueTrackers/trackerGrammars';
import { api } from '../../../api/client';
import { useIssueTrackerSetup } from '../../../components/issues/useIssueTrackers';
import { Button } from '../../../ui/Button';
import { TextField } from '../../../ui/TextField';
import { CheckedLine } from './CheckedLine';
import { connectFailureWords, connectsWithSignIn, hostOf, pickedSignInShown, signInMethodShown, linkReadBack, signInStepFor, type SignInRow, type SignInStep } from './connectFlow';
import { ConnectSteps } from './ConnectSteps';
import { LinkReadBackLine } from './LinkReadBackLine';
import { choiceAfterLink, connectWords, switchedWords, trackerChoiceCard, type TrackerChoice } from './trackerChoices';
import type { ConnectStage } from './trackerCardContent';
import { TrackerLogo } from './TrackerLogo';
import { DeviceSignIn } from './DeviceSignIn';
import { TokenSignIn } from './TokenSignIn';
import styles from './IssueTrackerPane.module.css';

export type SignedIn = Extract<SignInOutcome, { kind: 'signedIn' }>;

/** Where Connect starts: the tracker picked, with the sign-in picked to use, or the link a suggestion fills in. */
export interface ConnectStart {
  choice: TrackerChoice;
  picked?: SignInRow;
  link?: string;
}

interface ConnectTrackerProps {
  /** None in a window with no repository: the sign-in alone, kept for any repository to use. */
  repository?: string;
  start: ConnectStart;
  onConnected: (outcome: SignedIn) => void;
  /** Back: to where Connect was started from (the repository's card, the sign-ins). */
  onCancel: () => void;
}

/**
 * Connecting (docs/features/issue-trackers.md, "Connecting"), one card in steps (`ConnectSteps`), the tracker already
 * picked (a sign-in's Use, or "Add a sign-in"'s menu): paste a link to any of its issues, shown only its own link
 * shapes and read back in words; sign in, or connect with a sign-in already there. A link to another tracker's issue
 * moves to that tracker (`choiceAfterLink`). Back leaves.
 */
export function ConnectTracker({ repository, start, onConnected, onCancel }: ConnectTrackerProps) {
  const [choice, setChoice] = useState<TrackerChoice>(start.choice);
  const [link, setLink] = useState(start.link ?? '');
  const [switched, setSwitched] = useState(false);
  const [differentAccount, setDifferentAccount] = useState(false);
  const picked = start.picked ?? null;
  const read = linkReadBack(link);
  const setup = useIssueTrackerSetup();
  const step = read.kind === 'read' && setup ? signInStepFor(read.link, setup, { differentAccount }) : null;
  const stage: ConnectStage = read.kind === 'read' ? 'signIn' : 'link';
  const card = trackerChoiceCard(choice);
  const words = connectWords(card, repository !== undefined);

  const typed = (text: string): void => {
    const next = choiceAfterLink(choice, text);
    setLink(text);
    setChoice(next.choice);
    setSwitched(next.switched || (switched && text.trim() !== ''));
    setDifferentAccount(false);
  };

  return (
    <section className={styles.card} aria-label="Connect an issue tracker">
      <header className={styles.cardHeader}>
        <Button size="small" variant="ghost" className={styles.back} icon={<ChevronLeft size={15} />} aria-label="Back" onClick={onCancel} />
        <TrackerLogo choice={card.choice} />
        <div className={styles.cardHeaderText}>
          <h2 className={styles.cardTitle}>{words.title}</h2>
          <ConnectSteps stage={stage} trackerName={card.name} signedIn={connectsWithSignIn(picked?.id ?? null, read.kind === 'read', step)} />
        </div>
      </header>
      <div className={styles.section}>
        {picked && pickedSignInShown(picked.id, read.kind === 'read', step) && (
          <CheckedLine>
            With <strong>{picked.account}</strong>'s sign-in at {picked.host}
          </CheckedLine>
        )}
        <TextField className={styles.field} label={card.linkLabel} aria-label="A link to an issue" placeholder={card.placeholder} value={link} onChange={(event) => typed(event.target.value)} autoFocus />
        {read.kind === 'none' && (
          <ul className={styles.examples} aria-label="Link shapes">
            {card.examples.map((example) => (
              <li key={example.label}>
                <span className={styles.exampleLabel}>{example.label}</span>
                <span className={styles.exampleShape}>{example.shape}</span>
              </li>
            ))}
          </ul>
        )}
        {read.kind === 'read' && <LinkReadBackLine parts={read.parts} words={read.words} />}
        {read.kind === 'read' && switched && <p className={styles.note}>{switchedWords(card.choice)}</p>}
        {read.kind === 'problem' && <p className={styles.problem}>{read.words}</p>}
      </div>
      {read.kind === 'read' && step && (
        <div className={`${styles.section} ${styles.arrives}`}>
          <SignInFor
            key={`${link} ${differentAccount}`}
            link={read.link}
            linkText={link}
            step={step}
            repository={repository}
            picked={picked !== null && pickedSignInShown(picked.id, true, step)}
            onConnected={onConnected}
            onDifferentAccount={() => setDifferentAccount(true)}
          />
        </div>
      )}
    </section>
  );
}

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
function SignInFor({ link, linkText, step, repository, picked, onConnected, onDifferentAccount }: SignInForProps) {
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
      {method === 'deviceCode' && failure && <p className={styles.problem}>{connectFailureWords(failure, { trackerName: step.trackerName, server: link.server }).words}</p>}
    </div>
  );
}

/**
 * Connecting the repository with a sign-in already there: one click, proven with the link's project. Once the sign-in
 * was picked in the first step, the link step already says whose it is, so this is Connect alone.
 */
function UseConnection(props: {
  link: RecognizedLink;
  linkText: string;
  step: Extract<SignInStep, { kind: 'useConnection' }>;
  repository: string;
  picked: boolean;
  onConnected: (outcome: SignedIn) => void;
  onDifferentAccount: () => void;
}) {
  const { link, linkText, step, repository, picked, onConnected, onDifferentAccount } = props;
  const [failure, setFailure] = useState<SignInFailure | null>(null);
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
      {failure && <p className={styles.problem}>{connectFailureWords(failure, { trackerName: name, server: link.server }).words}</p>}
    </div>
  );
}

/** A quiet way past the sign-in already there: signing in with another account instead (`signInStepFor`). */
function DifferentAccountLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.textLink} onClick={onClick}>
      Use a different account
    </button>
  );
}
