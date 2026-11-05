import { ExternalLink } from 'lucide-react';
import { useEffect, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import type { TokenPageTarget } from '@shared/api/issueTrackers';
import type { IssueTrackerKind, SignInFailure, SignInOutcome, TokenSource } from '@shared/domain/issueTrackers';
import { TRACKER_GRAMMARS } from '@shared/issueTrackers/trackerGrammars';
import { api } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { TextField } from '../../../ui/TextField';
import { usePlaceUser } from '../../account/accounts';
import { connectFailureWords, submitsOnPaste, suggestedEmail, tokenStepReady, tokenStepWords } from './connectFlow';
import styles from './IssueTrackerPane.module.css';

interface TokenSignInProps {
  kind: IssueTrackerKind;
  server: string;
  /** Whose token page main opens, and for whom it offers a token copied there. */
  pageTarget: TokenPageTarget;
  /** Why the last try failed, said under the field. */
  failure: SignInFailure | null;
  /** Signs in with the token: a first sign-in for a repository, or a connection's again. */
  signIn: (source: TokenSource, email: string | undefined) => Promise<SignInOutcome>;
  onOutcome: (outcome: SignInOutcome) => void;
  /** The account's email kept from before, for Jira Cloud. */
  keptEmail?: string;
}

/**
 * Signing in with a token (docs/features/issue-trackers.md, "The token"): a masked field paste works in, which signs
 * in at once when what's pasted has the tracker's known shape; "Create a token" has main open its page, filled in
 * where the tracker allows; back in the window, a token copied there is offered in one click, main telling only whether
 * there is one. The token goes to main once, on submit, and the field forgets it.
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
  const [pageOpened, setPageOpened] = useState(false);
  const copiedTokenReady = useCopiedToken(pageTarget, pageOpened);
  const ready = tokenStepReady(kind, email, busy);

  const submit = async (source: TokenSource): Promise<void> => {
    setBusy(true);
    const outcome = await signIn(source, words.emailLabel ? email.trim() : undefined);
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
    if (!ready || !submitsOnPaste(kind, text)) return;
    event.preventDefault();
    void submit({ token: text });
  };
  // A step inside Settings' own form: Enter signs in here, never submits that form.
  const enterSignsIn = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (ready && token.trim()) void submit({ token });
  };
  const failed = failure && connectFailureWords(failure, { trackerName, server, ...(words.emailLabel && { email }) });

  return (
    <div className={styles.step}>
      {words.emailLabel && <TextField label={words.emailLabel} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />}
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
 * Whether a token shaped as this tracker's is on the clipboard, asked of main when the window comes back after main
 * opened the token page: main answers yes or no, never the token.
 */
function useCopiedToken(pageTarget: TokenPageTarget, pageOpened: boolean): boolean {
  const [ready, setReady] = useState(false);
  const target = JSON.stringify(pageTarget);
  useEffect(() => {
    if (!pageOpened) return;
    let current = true;
    const check = (): void => {
      void api.issueTrackers.clipboardHoldsToken(JSON.parse(target) as TokenPageTarget).then((holds) => current && setReady(holds));
    };
    window.addEventListener('focus', check);
    return () => {
      current = false;
      window.removeEventListener('focus', check);
    };
  }, [target, pageOpened]);
  return ready;
}
