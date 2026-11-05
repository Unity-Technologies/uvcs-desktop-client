import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import type { SignInOutcome } from '@shared/domain/issueTrackers';
import { useIssueTrackerSetup } from '../../../components/issues/useIssueTrackers';
import { Button } from '../../../ui/Button';
import { TextField } from '../../../ui/TextField';
import { CheckedLine } from './CheckedLine';
import { connectStage, connectsWithSignIn, pickedSignInShown, linkReadBack, signInStepFor, type SignInRow } from './connectFlow';
import { ConnectSteps } from './ConnectSteps';
import { LinkReadBackLine } from './LinkReadBackLine';
import { SignInFor } from './SignInFor';
import { choiceAfterLink, connectWords, switchedWords, trackerChoiceCard, type TrackerChoice } from './trackerChoices';
import { TrackerLogo } from './TrackerLogo';
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
  const stage = connectStage(read);
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
    <section className={styles.card} aria-label={words.title}>
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
