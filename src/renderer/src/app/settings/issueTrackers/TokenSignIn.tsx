import { ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import type { TokenPageTarget } from '@shared/api/issueTrackers';
import type { IssueTrackerKind, SignInFailure, SignInOutcome } from '@shared/domain/issueTrackers';
import { TRACKER_GRAMMARS } from '@shared/issueTrackers/trackerGrammars';
import { api } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { TextField } from '../../../ui/TextField';
import { usePlaceUser } from '../../account/accounts';
import { clearsClipboardAfter, connectFailureWords, otherTokenPageOffered, submitsOnPaste, suggestedEmail, tokenStepReady, tokenStepWords } from './connectFlow';
import { tokenStepLead } from './trackerCardContent';
import styles from './IssueTrackerPane.module.css';

interface TokenSignInProps {
  kind: IssueTrackerKind;
  server: string;
  /** Whose token page "Create a token" opens. */
  pageTarget: TokenPageTarget;
  /** Why the last try failed, said under the field. */
  failure: SignInFailure | null;
  /** Signs in with the token: a first sign-in for a repository, or a connection's again. */
  signIn: (token: string, email: string | undefined) => Promise<SignInOutcome>;
  onOutcome: (outcome: SignInOutcome) => void;
  /** The account's email kept from before, for Jira Cloud. */
  keptEmail?: string;
}

/**
 * Signing in with a token (docs/features/issue-trackers.md, "The token"): a masked field paste works in, which signs
 * in at once when what's pasted has the tracker's known shape; "Create a token" opens its page, filled in where the
 * tracker allows. The app never reads the clipboard by itself: only a paste the user makes reaches the field. The
 * token goes to main once, on submit, and the field forgets it; a token pasted and signed in with is cleared from the
 * clipboard. One button leads (`tokenStepLead`): "Create a token" until a token is in the field, then "Sign in".
 */
export function TokenSignIn({ kind, server, pageTarget, failure, signIn, onOutcome, keptEmail }: TokenSignInProps) {
  const words = tokenStepWords(kind);
  const trackerName = TRACKER_GRAMMARS[kind].name;
  // Filled in until the user types one: the `cm` user may be read after the step shows.
  const cmUser = usePlaceUser();
  const [typedEmail, setEmail] = useState<string | null>(null);
  const email = typedEmail ?? suggestedEmail(cmUser, keptEmail);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (typed: string, { pasted = false } = {}): Promise<void> => {
    setBusy(true);
    const outcome = await signIn(typed, words.emailLabel ? email.trim() : undefined);
    setToken('');
    setBusy(false);
    // The token the user pasted isn't left on the clipboard to be pasted somewhere by mistake (`clearsClipboardAfter`).
    if (clearsClipboardAfter(pasted, outcome)) void navigator.clipboard.writeText('').catch(() => undefined);
    onOutcome(outcome);
  };
  const openTokenPage = (): void => {
    void api.issueTrackers.openTokenPage(pageTarget);
  };
  const openOtherTokenPage = (): void => {
    void api.issueTrackers.openTokenPage(pageTarget, 'other');
  };
  const pasted = (event: ClipboardEvent<HTMLInputElement>): void => {
    const text = event.clipboardData.getData('text');
    if (!tokenStepReady(kind, email, text, busy) || !submitsOnPaste(kind, text)) return;
    event.preventDefault();
    void submit(text, { pasted: true });
  };
  // A step inside Settings' own form: Enter signs in here, never submits that form.
  const enterSignsIn = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (tokenStepReady(kind, email, token, busy)) void submit(token);
  };
  const failed = failure && connectFailureWords(failure, { trackerName, server, ...(words.emailLabel && { email }) });
  // A failure is said where the eye is: under Sign in, scrolled into view when the step is taller than the pane.
  const problem = useRef<HTMLDivElement>(null);
  useEffect(() => problem.current?.scrollIntoView({ block: 'nearest' }), [failure]);
  const lead = tokenStepLead(token);

  return (
    <div className={styles.next}>
      <div className={styles.row}>
        <Button size="small" variant={lead === 'createToken' ? 'primary' : 'secondary'} icon={<ExternalLink size={13} />} onClick={openTokenPage}>
          Create a token
        </Button>
        {otherTokenPageOffered(kind) && (
          <Button size="small" variant="ghost" onClick={openOtherTokenPage} title={`Opens the other page ${trackerName} makes tokens on`}>
            Other token page
          </Button>
        )}
      </div>
      {words.emailLabel && <TextField label={words.emailLabel} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />}
      <TextField
        label={words.tokenLabel}
        type="password"
        autoComplete="off"
        placeholder="Paste the token"
        value={token}
        onChange={(event) => setToken(event.target.value)}
        onPaste={pasted}
        onKeyDown={enterSignsIn}
        hint={words.hint}
      />
      <div className={styles.row}>
        <Button size="small" variant={lead === 'signIn' ? 'primary' : 'secondary'} disabled={!tokenStepReady(kind, email, token, busy)} loading={busy} onClick={() => void submit(token)}>
          Sign in
        </Button>
      </div>
      {failed && (
        <div ref={problem} className={styles.row} role="alert">
          <p className={styles.problem}>{failed.words}</p>
          {failed.offersTokenPage && (
            <Button size="small" variant="ghost" onClick={openTokenPage}>
              Create a new token
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
