import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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
import { ChevronLeft } from 'lucide-react';
import { CheckedLine } from './CheckedLine';
import { connectFailureWords, hostOf, signInMethodShown, LINK_EXAMPLES, LINK_PLACEHOLDER, linkReadBack, signInStepFor, suggestedTrackerLink, type SignInStep } from './connectFlow';
import { ConnectSteps } from './ConnectSteps';
import { LinkReadBackLine } from './ProofLines';
import { TrackerIcon } from './TrackerIcon';
import { DeviceSignIn } from './DeviceSignIn';
import { TokenSignIn } from './TokenSignIn';
import styles from './IssueTrackerPane.module.css';

type SignedIn = Extract<SignInOutcome, { kind: 'signedIn' }>;

interface ConnectTrackerProps {
  repository: string;
  onConnected: (outcome: SignedIn) => void;
  /** Changing a tracker already connected: back to it. */
  onCancel?: () => void;
}

/**
 * Connecting the repository's tracker (docs/features/issue-trackers.md, "Connecting"), one card: paste a link, read
 * back in words; sign in, or use a sign-in already there; the proof follows on the connected card. Each step shows
 * once the one before is done, and the header says where the user is (`ConnectSteps`); changing a tracker has a Back.
 */
export function ConnectTracker({ repository, onConnected, onCancel }: ConnectTrackerProps) {
  const [link, setLink] = useState('');
  const read = linkReadBack(link);
  const suggestion = useSuggestedLink();
  const setup = useIssueTrackerSetup();
  const step = read.kind === 'read' && setup ? signInStepFor(read.link, setup) : null;

  return (
    <section className={styles.card} aria-label="Connect an issue tracker">
      <header className={styles.cardHeader}>
        {onCancel && (
          <Button size="small" variant="ghost" icon={<ChevronLeft size={14} />} onClick={onCancel}>
            Back
          </Button>
        )}
        <div className={styles.cardHeaderText}>
          <h2 className={styles.cardTitle}>Connect an issue tracker</h2>
        </div>
        <ConnectSteps linkRead={read.kind === 'read'} />
      </header>
      <div className={styles.section}>
        {read.kind === 'none' && !onCancel && (
          <div className={styles.empty}>
            <TrackerIcon kind={null} size={20} />
            <p className={styles.sectionTitle}>See your issues where comments name them</p>
            <p className={styles.intro}>Paste a link to any issue in Jira or GitHub. The app works out the rest.</p>
          </div>
        )}
        {(read.kind !== 'none' || onCancel) && <p className={styles.intro}>Paste a link to any issue in your tracker. The app works out the rest.</p>}
        <TextField className={styles.field} aria-label="A link to an issue" placeholder={LINK_PLACEHOLDER} value={link} onChange={(event) => setLink(event.target.value)} autoFocus />
        {read.kind === 'read' && <LinkReadBackLine parts={read.parts} words={read.words} />}
        {read.kind === 'problem' && <p className={styles.problem}>{read.words}</p>}
        {read.kind === 'none' && suggestion && (
          <div className={styles.callout} data-tone="neutral">
            <p className={styles.nextTitle}>Your branch comments link to {suggestion.trackerName}</p>
            <div className={styles.row}>
              <span className={styles.intro}>{suggestion.words}</span>
              <Button size="small" onClick={() => setLink(suggestion.link)}>
                Use this
              </Button>
            </div>
            <p className={styles.note}>{suggestion.seen}</p>
          </div>
        )}
        {read.kind === 'none' && !suggestion && (
          <dl className={styles.examples}>
            {LINK_EXAMPLES.map((example) => (
              <div key={example.tracker} className={styles.example}>
                <dt>{example.tracker}</dt>
                <dd>{example.shape}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {read.kind === 'read' && step && (
        <div className={styles.section}>
          <SignInFor key={link} link={read.link} linkText={link} step={step} repository={repository} onConnected={onConnected} />
        </div>
      )}
    </section>
  );
}

interface SignInForProps {
  link: RecognizedLink;
  linkText: string;
  step: SignInStep;
  repository: string;
  onConnected: (outcome: SignedIn) => void;
}

/** The sign-in step for a link read back: a sign-in already there in one click, else the tracker's best method. */
function SignInFor({ link, linkText, step, repository, onConnected }: SignInForProps) {
  const [failure, setFailure] = useState<SignInFailure | null>(null);
  const [tokenChosen, setTokenChosen] = useState(false);
  const method = step.kind === 'signIn' ? signInMethodShown(step.methods, tokenChosen) : 'token';
  const [busy, setBusy] = useState(false);
  const finish = (outcome: SignInOutcome): void => {
    if (outcome.kind === 'signedIn') onConnected(outcome);
    else setFailure(outcome.failure);
  };

  if (step.kind === 'useConnection') {
    const name = TRACKER_GRAMMARS[step.connection.kind].name;
    const use = async (): Promise<void> => {
      setBusy(true);
      finish(await api.issueTrackers.useConnection({ repository, link: linkText, connectionId: step.connection.id }));
      setBusy(false);
    };
    return (
      <div className={styles.next}>
        <p className={styles.nextTitle}>Next: use your {name} sign-in</p>
        <CheckedLine>
          Signed in as <strong>{step.connection.account.name}</strong> at {hostOf(step.connection.server)}
        </CheckedLine>
        <div className={styles.row}>
          <Button size="small" variant="primary" loading={busy} onClick={() => void use()}>
            Use it
          </Button>
        </div>
        {failure && <p className={styles.problem}>{connectFailureWords(failure, { trackerName: name, server: link.server }).words}</p>}
      </div>
    );
  }
  return (
    <div className={styles.next}>
      <p className={styles.nextTitle}>Next: sign in to {step.trackerName}</p>
      <p className={styles.intro}>So the app can show each issue’s title and status. It only reads.</p>
      {method === 'deviceCode' ? (
        <DeviceSignIn request={{ repository, link: linkText }} trackerName={step.trackerName} onOutcome={finish} onUseToken={() => setTokenChosen(true)} />
      ) : (
        <TokenSignIn
          kind={link.kind}
          server={link.server}
          pageTarget={{ link: linkText }}
          failure={failure}
          onOutcome={finish}
          signIn={(token, email) => api.issueTrackers.signInWithToken({ repository, link: linkText, token, ...(email && { email }) })}
        />
      )}
      {method === 'deviceCode' && failure && <p className={styles.problem}>{connectFailureWords(failure, { trackerName: step.trackerName, server: link.server }).words}</p>}
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
