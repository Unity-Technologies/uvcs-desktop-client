import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Branch } from '@shared/domain/branch';
import type { SignInFailure, SignInOutcome } from '@shared/domain/issueTrackers';
import type { RecognizedLink } from '@shared/issueTrackers/trackerGrammar';
import { TRACKER_GRAMMARS } from '@shared/issueTrackers/trackerGrammars';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { useIssueTrackerSetup } from '../../../components/issues/useIssueTrackers';
import { Button } from '../../../ui/Button';
import { TextField } from '../../../ui/TextField';
import { useSession } from '../../workspace/sessionStore';
import { CheckedLine } from './CheckedLine';
import { connectFailureWords, connectsWithSignIn, hostOf, pickedSignInShown, signInMethodShown, linkReadBack, signInStepFor, suggestedTrackerLink, usableSignIns, type SignInRow, type SignInStep, type SuggestedLink } from './connectFlow';
import { ConnectSteps } from './ConnectSteps';
import { LinkReadBackLine } from './LinkReadBackLine';
import { SignInIdentity } from './SignInIdentity';
import { choiceAfterLink, choiceKeyMove, choiceOf, connectWords, PICKER_WORDS, switchedWords, TRACKER_CHOICES, trackerChoiceCard, type TrackerChoice } from './trackerChoices';
import type { ConnectStage } from './trackerCardContent';
import { TrackerLogo } from './TrackerLogo';
import { DeviceSignIn } from './DeviceSignIn';
import { TokenSignIn } from './TokenSignIn';
import styles from './IssueTrackerPane.module.css';

type SignedIn = Extract<SignInOutcome, { kind: 'signedIn' }>;

interface ConnectTrackerProps {
  /** None in a window with no repository: the sign-in alone, kept for any repository to use. */
  repository?: string;
  onConnected: (outcome: SignedIn) => void;
  /** Changing a tracker already connected: back to it. Adding a sign-in on Home: back to the sign-ins. */
  onCancel?: () => void;
  /** The tracker already chosen (Home's "Add a sign-in" menu): no first step to pick one, and Back leaves. */
  startWith?: TrackerChoice;
}

/**
 * Connecting the repository's tracker (docs/features/issue-trackers.md, "Connecting"), one card in three steps
 * (`ConnectSteps`): pick the tracker from its logo (`TRACKER_CHOICES`); paste a link to any of its issues, shown only
 * its own link shapes and read back in words; sign in, or use a sign-in already there. Back goes one step back, or to
 * the tracker connected. A link to another tracker's issue moves to that tracker (`choiceAfterLink`).
 */
export function ConnectTracker({ repository, onConnected, onCancel, startWith }: ConnectTrackerProps) {
  const [choice, setChoice] = useState<TrackerChoice | null>(startWith ?? null);
  const [link, setLink] = useState('');
  const [switched, setSwitched] = useState(false);
  const [differentAccount, setDifferentAccount] = useState(false);
  // The sign-in picked in the first step ("Use a sign-in you already have"), carried to the link step.
  const [picked, setPicked] = useState<SignInRow | null>(null);
  const read = linkReadBack(link);
  const suggestion = useSuggestedLink();
  const setup = useIssueTrackerSetup();
  const step = read.kind === 'read' && setup ? signInStepFor(read.link, setup, { differentAccount }) : null;
  const stage: ConnectStage = !choice ? 'tracker' : read.kind === 'read' ? 'signIn' : 'link';
  const card = choice ? trackerChoiceCard(choice) : null;
  const words = connectWords(card, repository !== undefined);

  const choose = (chosen: TrackerChoice | null, text = '', signIn: SignInRow | null = null): void => {
    setChoice(chosen);
    setPicked(signIn);
    setLink(text);
    setSwitched(false);
    setDifferentAccount(false);
  };
  const typed = (text: string): void => {
    const next = choiceAfterLink(choice ?? 'jira', text);
    setLink(text);
    setChoice(next.choice);
    setSwitched(next.switched || (switched && text.trim() !== ''));
    setDifferentAccount(false);
  };
  const back = choice && !startWith ? () => choose(null) : onCancel;

  return (
    <section className={styles.card} aria-label="Connect an issue tracker">
      <header className={styles.cardHeader}>
        {back && <Button size="small" variant="ghost" className={styles.back} icon={<ChevronLeft size={15} />} aria-label="Back" onClick={back} />}
        {card && <TrackerLogo choice={card.choice} />}
        <div className={styles.cardHeaderText}>
          <h2 className={styles.cardTitle}>{words.title}</h2>
          <ConnectSteps stage={stage} {...(card && { trackerName: card.name })} signedIn={connectsWithSignIn(picked?.id ?? null, read.kind === 'read', step)} />
        </div>
      </header>
      {!card && (
        <TrackerPicker
          intro={words.intro}
          suggestion={repository ? suggestion : null}
          signIns={repository ? usableSignIns(setup) : []}
          onChoose={choose}
          onPickSignIn={(signIn) => choose(choiceOf(signIn.kind), '', signIn)}
        />
      )}
      {card && (
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
      )}
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

/**
 * The first step: a card per tracker, its logo, name and servers, to click or reach with the arrows; above them, the
 * tracker the branch comments link to, in one click with its link filled in. Where the computer already keeps
 * sign-ins, they come first ("Use a sign-in you already have"), and the trackers, smaller, after them.
 */
interface TrackerPickerProps {
  intro: string;
  suggestion: SuggestedLink | null;
  /** The sign-ins this computer keeps that work, offered first (`usableSignIns`); none in a window with no repository. */
  signIns: readonly SignInRow[];
  onChoose: (choice: TrackerChoice, link?: string) => void;
  onPickSignIn: (signIn: SignInRow) => void;
}

function TrackerPicker({ intro, suggestion, signIns, onChoose, onPickSignIn }: TrackerPickerProps) {
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const arrows = (event: KeyboardEvent<HTMLDivElement>): void => {
    const at = cards.current.findIndex((card) => card === document.activeElement);
    const next = choiceKeyMove(at, event.key, TRACKER_CHOICES.length);
    if (at < 0 || next === null) return;
    event.preventDefault();
    cards.current[next]?.focus();
  };
  const suggested = suggestion && linkReadBack(suggestion.link);
  return (
    <div className={styles.section}>
      <p className={styles.intro}>{intro}</p>
      {suggestion && suggested?.kind === 'read' && (
        <div className={styles.suggested}>
          <TrackerLogo choice={choiceOf(suggested.link.kind)} size={24} />
          <div className={styles.cardHeaderText}>
            <span className={styles.nextTitle}>Your branch comments link to {suggestion.trackerName}</span>
            <span className={styles.personDetail}>
              {suggestion.words} · {suggestion.seen}
            </span>
          </div>
          <Button size="small" variant="primary" onClick={() => onChoose(choiceOf(suggested.link.kind), suggestion.link)}>
            Use it
          </Button>
        </div>
      )}
      {signIns.length > 0 && (
        <>
          <h3 className={styles.pickerTitle}>{PICKER_WORDS.signIns}</h3>
          <ul className={styles.tiles}>
            {signIns.map((signIn) => (
              <li key={signIn.id}>
                <button type="button" className={`${styles.signInTile} ${styles.signInPick}`} onClick={() => onPickSignIn(signIn)} aria-label={`${signIn.account}, ${signIn.title}`}>
                  <SignInIdentity row={signIn} />
                  <ChevronRight className={styles.pickChevron} size={15} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <h3 className={styles.pickerTitle}>{PICKER_WORDS.others}</h3>
        </>
      )}
      <div className={styles.choices} data-compact={signIns.length > 0 || undefined} role="group" aria-label="Trackers" onKeyDown={arrows}>
        {TRACKER_CHOICES.map((card, index) => (
          <button
            key={card.choice}
            ref={(element) => {
              cards.current[index] = element;
            }}
            type="button"
            className={styles.choiceCard}
            onClick={() => onChoose(card.choice)}
            autoFocus={index === 0 && !suggestion && signIns.length === 0}
          >
            <TrackerLogo choice={card.choice} size={signIns.length > 0 ? 28 : 44} />
            <span className={styles.choiceText}>
              <span className={styles.choiceName}>{card.name}</span>
              <span className={styles.choiceServers}>{card.servers}</span>
            </span>
            <ChevronRight className={styles.choiceChevron} size={14} aria-hidden />
          </button>
        ))}
      </div>
    </div>
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
      {step.replaces && <p className={styles.note}>Signing in here replaces {step.replaces}'s sign-in, for every repository that uses it.</p>}
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

/** A tracker the branch comments the window already read link to: offered, never filled in. Reads nothing. */
function useSuggestedLink() {
  const queryClient = useQueryClient();
  const place = useSession((state) => state.place);
  return useMemo(() => {
    if (!place) return null;
    const lists = queryClient.getQueriesData<Branch[]>({ queryKey: queryKeys.inPlace(place, 'branches') });
    const comments = lists.flatMap(([, branches]) => (Array.isArray(branches) ? branches.map((branch) => branch.comment ?? '') : []));
    return suggestedTrackerLink(comments);
  }, [queryClient, place]);
}

/** A quiet way past the sign-in already there: signing in with another account instead (`signInStepFor`). */
function DifferentAccountLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.textLink} onClick={onClick}>
      Use a different account
    </button>
  );
}
