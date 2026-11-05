import { Check, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { TokenPageTarget } from '@shared/api/issueTrackers';
import type { IssueTrackerKind, SignInFailure, SignInOutcome } from '@shared/domain/issueTrackers';
import { TRACKER_GRAMMARS } from '@shared/issueTrackers/trackerGrammars';
import { api } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { TextField } from '../../../ui/TextField';
import { useWindowUser } from '../../account/accounts';
import { clearsClipboardAfter, connectFailureWords, OTHER_TOKEN_PAGE_WORDS, otherTokenPageOffered, suggestedEmail, tokenStepReady, tokenStepWords } from './connectFlow';
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
 * Signing in with a token (docs/features/issue-trackers.md, "The token"): step one opens the tracker's token page,
 * filled in where the tracker allows; step two is a masked field paste works in, then Sign in (or Enter), on every
 * tracker alike. The app never reads the clipboard by itself: only a paste the user makes reaches the field. The token
 * goes to main once, on submit, and the field forgets it; a token pasted and signed in with is cleared from the
 * clipboard. One button leads (`tokenStepLead`): the token page's until a token is in the field, then "Sign in".
 */
export function TokenSignIn({ kind, server, pageTarget, failure, signIn, onOutcome, keptEmail }: TokenSignInProps) {
  const words = tokenStepWords(kind);
  const trackerName = TRACKER_GRAMMARS[kind].name;
  // Filled in until the user types one: the `cm` user may be read after the step shows.
  const cmUser = useWindowUser();
  const [typedEmail, setEmail] = useState<string | null>(null);
  const email = typedEmail ?? suggestedEmail(cmUser, keptEmail);
  const [token, setToken] = useState('');
  // Whether the token in the field came from a paste: the clipboard is cleared once it signs in.
  const [fromPaste, setFromPaste] = useState(false);
  const pasting = useRef(false);
  const [busy, setBusy] = useState(false);

  const submit = async (typed: string): Promise<void> => {
    setBusy(true);
    const outcome = await signIn(typed, words.emailLabel ? email.trim() : undefined);
    setToken('');
    setBusy(false);
    // The token the user pasted isn't left on the clipboard to be pasted somewhere by mistake (`clearsClipboardAfter`).
    if (clearsClipboardAfter(fromPaste, outcome)) void navigator.clipboard.writeText('').catch(() => undefined);
    onOutcome(outcome);
  };
  const openTokenPage = (): void => {
    void api.issueTrackers.openTokenPage(pageTarget);
  };
  const openOtherTokenPage = (): void => {
    void api.issueTrackers.openTokenPage(pageTarget, 'other');
  };
  // A paste only fills the field, masked: the user signs in with Sign in or Enter, on every tracker alike.
  const pasted = (): void => {
    pasting.current = true;
  };
  const changed = (value: string): void => {
    setToken(value);
    setFromPaste(pasting.current);
    pasting.current = false;
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
  // A block body: Chromium's `scrollIntoView` returns a promise now, which React would take for a clean-up.
  useEffect(() => {
    problem.current?.scrollIntoView({ block: 'nearest' });
  }, [failure]);
  const lead = tokenStepLead(token);

  return (
    <ol className={styles.guide}>
      <li className={styles.guideStep} data-done={lead === 'signIn' || undefined}>
        <span className={styles.guideNumber} aria-hidden>
          {lead === 'signIn' ? <Check size={12} strokeWidth={3} /> : 1}
        </span>
        <div className={styles.guideBody}>
          <p className={styles.nextTitle}>{words.getTitle}</p>
          <p className={styles.note}>{words.createWhere}</p>
          <div className={styles.row}>
            <Button size="small" variant={lead === 'createToken' ? 'primary' : 'secondary'} icon={<ExternalLink size={13} />} onClick={openTokenPage}>
              {words.createButton}
            </Button>
          </div>
          {otherTokenPageOffered(kind) && (
            <p className={styles.note}>
              {OTHER_TOKEN_PAGE_WORDS.lead}{' '}
              <button type="button" className={styles.textLink} onClick={openOtherTokenPage} title={`Opens the other page ${trackerName} makes tokens on`}>
                {OTHER_TOKEN_PAGE_WORDS.link}
              </button>
            </p>
          )}
        </div>
      </li>
      <li className={styles.guideStep}>
        <span className={styles.guideNumber} aria-hidden>
          2
        </span>
        <div className={styles.guideBody}>
          <p className={styles.nextTitle}>Paste it here</p>
          {words.emailLabel && <TextField label={words.emailLabel} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />}
          <div className={styles.pasteRow}>
            <TextField
              className={styles.field}
              aria-label={words.tokenLabel}
              type="password"
              autoComplete="off"
              placeholder={`Paste the ${words.tokenLabel}`}
              value={token}
              onChange={(event) => changed(event.target.value)}
              onPaste={pasted}
              onKeyDown={enterSignsIn}
            />
            <Button size="medium" variant={lead === 'signIn' ? 'primary' : 'secondary'} disabled={!tokenStepReady(kind, email, token, busy)} loading={busy} onClick={() => void submit(token)}>
              Sign in
            </Button>
          </div>
          <p className={styles.note}>{words.hint}</p>
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
      </li>
    </ol>
  );
}
