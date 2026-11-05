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
import { connectFailureWords, LINK_EXAMPLES, LINK_PLACEHOLDER, linkReadBack, signInStepFor, suggestedTrackerLink, type SignInStep } from './connectFlow';
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
 * Connecting the repository's tracker (docs/features/issue-trackers.md, "Connecting"): paste a link, read back in
 * words; sign in, or use a sign-in already there; the proof follows. Each step shows once the one before is done.
 */
export function ConnectTracker({ repository, onConnected, onCancel }: ConnectTrackerProps) {
  const [link, setLink] = useState('');
  const read = linkReadBack(link);
  const suggestion = useSuggestedLink();
  const setup = useIssueTrackerSetup();
  const step = read.kind === 'read' && setup ? signInStepFor(read.link, setup) : null;

  return (
    <section className={styles.step} aria-label="Connect an issue tracker">
      <p className={styles.intro}>Paste a link to any issue from your tracker. Open one in your browser and copy its address: the app works out the rest.</p>
      <TextField className={styles.field} aria-label="A link to an issue" placeholder={LINK_PLACEHOLDER} value={link} onChange={(event) => setLink(event.target.value)} autoFocus />
      {read.kind === 'read' && <p className={styles.readBack}>{read.words}</p>}
      {read.kind === 'problem' && <p className={styles.problem}>{read.words}</p>}
      {read.kind === 'none' && suggestion && (
        <div className={styles.card}>
          <p className={styles.cardLine}>Your branch comments link to {suggestion.trackerName}</p>
          <div className={styles.row}>
            <span className={styles.readBack}>{suggestion.words}</span>
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
      {read.kind === 'read' && step && <SignInFor key={link} link={read.link} linkText={link} step={step} repository={repository} onConnected={onConnected} />}
      {onCancel && (
        <div className={styles.row}>
          <Button size="small" variant="ghost" onClick={onCancel}>
            Keep the current tracker
          </Button>
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
  const [method, setMethod] = useState(step.kind === 'signIn' ? step.methods[0]! : 'token');
  const [busy, setBusy] = useState(false);
  const finish = (outcome: SignInOutcome): void => {
    if (outcome.kind === 'signedIn') onConnected(outcome);
    else setFailure(outcome.failure);
  };

  if (step.kind === 'useConnection') {
    const use = async (): Promise<void> => {
      setBusy(true);
      finish(await api.issueTrackers.useConnection({ repository, link: linkText, connectionId: step.connection.id }));
      setBusy(false);
    };
    return (
      <div className={styles.card}>
        <p className={styles.cardLine}>Use {step.words}</p>
        <div className={styles.row}>
          <Button size="small" variant="primary" loading={busy} onClick={() => void use()}>
            Use it
          </Button>
        </div>
        {failure && <p className={styles.problem}>{connectFailureWords(failure, { trackerName: TRACKER_GRAMMARS[step.connection.kind].name, server: link.server }).words}</p>}
      </div>
    );
  }
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>Sign in to {step.trackerName}</h3>
      <p className={styles.cardLine}>So the app can show each issue’s title and status.</p>
      {method === 'deviceCode' ? (
        <DeviceSignIn repository={repository} linkText={linkText} trackerName={step.trackerName} onOutcome={finish} onUseToken={() => setMethod('token')} />
      ) : (
        <TokenSignIn request={{ repository, link: linkText }} pageTarget={{ link: linkText }} link={link} trackerName={step.trackerName} needsEmail={step.needsEmail} failure={failure} onOutcome={finish} />
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
