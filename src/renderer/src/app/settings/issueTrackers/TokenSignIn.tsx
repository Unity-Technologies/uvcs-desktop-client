import { ExternalLink } from 'lucide-react';
import { useEffect, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import type { RepositorySignIn, TokenPageTarget } from '@shared/api/issueTrackers';
import type { SignInFailure, SignInOutcome, TokenSource } from '@shared/domain/issueTrackers';
import type { RecognizedLink } from '@shared/issueTrackers/trackerGrammar';
import { api } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { TextField } from '../../../ui/TextField';
import { usePlaceUser } from '../../account/accounts';
import { connectFailureWords, submitsOnPaste, suggestedEmail } from './connectFlow';
import styles from './IssueTrackerPane.module.css';

interface TokenSignInProps {
  /** The repository and link a first sign-in binds; none when signing in again (`signIn` says how). */
  request: Omit<RepositorySignIn, 'email'>;
  /** Whose token page main opens, and for whom it offers a token copied there. */
  pageTarget: TokenPageTarget;
  link: Pick<RecognizedLink, 'kind' | 'server'>;
  trackerName: string;
  needsEmail: boolean;
  /** Why the last try failed, said under the field. */
  failure: SignInFailure | null;
  onOutcome: (outcome: SignInOutcome) => void;
  /** Signs in with the token; a first sign-in by default. */
  signIn?: (source: TokenSource, email: string | undefined) => Promise<SignInOutcome>;
  /** The account's email kept from before, for Jira Cloud. */
  keptEmail?: string;
}

/**
 * Signing in with a token (docs/features/issue-trackers.md, "Sign-in"): a masked field paste works in, which signs in
 * at once when what's pasted has the tracker's known shape; "Create a token" opens its page, filled in where the
 * tracker allows; back in the window, a token copied there is offered in one click, main telling only whether there
 * is one. The token goes to main once, on submit, and the field forgets it.
 */
export function TokenSignIn({ request, pageTarget, link, trackerName, needsEmail, failure, onOutcome, signIn, keptEmail }: TokenSignInProps) {
  // Filled in until the user types one: the `cm` user may be read after the step shows.
  const cmUser = usePlaceUser();
  const [typedEmail, setEmail] = useState<string | null>(null);
  const email = typedEmail ?? suggestedEmail(cmUser, keptEmail);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [pageOpened, setPageOpened] = useState(false);
  const copiedTokenReady = useCopiedToken(pageTarget, pageOpened);
  const ready = (!needsEmail || email.trim() !== '') && !busy;

  const submit = async (source: TokenSource): Promise<void> => {
    setBusy(true);
    const outcome = signIn
      ? await signIn(source, needsEmail ? email.trim() : undefined)
      : await api.issueTrackers.signInWithToken({ ...request, ...(needsEmail && { email: email.trim() }), source });
    setToken('');
    setBusy(false);
    onOutcome(outcome);
  };
  const openTokenPage = (): void => {
    setPageOpened(true);
    void api.issueTrackers.openTokenPage(pageTarget);
  };
  const pasted = (event: ClipboardEvent<HTMLInputElement>): void => {
    const text = event.clipboardData.getData('text');
    if (!ready || !submitsOnPaste(link.kind, text)) return;
    event.preventDefault();
    void submit({ token: text });
  };
  // A step inside Settings' own form: Enter signs in here, never submits that form.
  const enterSignsIn = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (ready && token.trim()) void submit({ token });
  };
  const failed = failure && connectFailureWords(failure, { trackerName, server: link.server, ...(needsEmail && { email }) });

  return (
    <div className={styles.step}>
      {needsEmail && <TextField label="Your Atlassian account email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />}
      <div className={styles.row}>
        <Button size="small" icon={<ExternalLink size={13} />} onClick={openTokenPage}>
          Create a token
        </Button>
        {copiedTokenReady && (
          <Button size="small" variant="primary" disabled={!ready} loading={busy} onClick={() => void submit({ copied: true })}>
            Use the copied token
          </Button>
        )}
      </div>
      <TextField
        label={`${trackerName} token`}
        type="password"
        autoComplete="off"
        placeholder="Paste the token"
        value={token}
        onChange={(event) => setToken(event.target.value)}
        onPaste={pasted}
        onKeyDown={enterSignsIn}
        hint={needsEmail ? 'An API token, made on your Atlassian account’s Security page.' : 'Reading issues is all the app asks of it.'}
      />
      <div className={styles.row}>
        <Button size="small" variant={copiedTokenReady ? 'secondary' : 'primary'} disabled={!ready || !token.trim()} loading={busy && !copiedTokenReady} onClick={() => void submit({ token })}>
          Sign in
        </Button>
      </div>
      {failed && (
        <div className={styles.row}>
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

/**
 * Whether a token shaped as this tracker's is on the clipboard, asked of main when the window comes back after the
 * token page opened: main answers yes or no, never the token.
 */
function useCopiedToken(pageTarget: TokenPageTarget, pageOpened: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!pageOpened) return;
    let current = true;
    const check = (): void => {
      void api.issueTrackers.clipboardHoldsToken(pageTarget).then((holds) => current && setReady(holds));
    };
    window.addEventListener('focus', check);
    return () => {
      current = false;
      window.removeEventListener('focus', check);
    };
  }, [JSON.stringify(pageTarget), pageOpened]);
  return ready;
}
