import { api } from '../../../api/client';
import { useIssueTrackerSetup } from '../../../components/issues/useIssueTrackers';
import { Button } from '../../../ui/Button';
import { confirm } from '../../../ui/dialog/confirm';
import { signInRows, type SignInRow } from './connectFlow';
import { StatusPill } from './StatusPill';
import { TrackerIcon } from './TrackerIcon';
import styles from './IssueTrackerPane.module.css';

/**
 * The sign-ins this computer keeps (docs/features/issue-trackers.md, "Connecting"), the same card in every window: each
 * with its logo, account and how it stands, the one the window's repository uses marked, and Sign out. In a window
 * with no repository it's the whole pane; in a repository's, it sits under the repository's tracker, once there is one.
 */
export function SignInsCard({ repository }: { repository?: string }) {
  const rows = signInRows(useIssueTrackerSetup(), repository);
  if (repository && rows.length === 0) return null;
  return (
    <section className={styles.card} aria-label="Issue tracker sign-ins">
      <header className={styles.cardHeader}>
        <div className={styles.cardHeaderText}>
          <h2 className={styles.cardTitle}>{repository ? 'Sign-ins on this computer' : 'Issue tracker sign-ins'}</h2>
          <span className={styles.cardSubtitle}>{repository ? 'Any repository can use them.' : 'Open a workspace or a repository to connect its tracker.'}</span>
        </div>
      </header>
      <div className={styles.section}>
        {rows.length === 0 && <p className={styles.note}>No sign-ins on this computer yet.</p>}
        {rows.length > 0 && (
          <ul className={styles.list}>
            {rows.map((row) => (
              <SignInLine key={row.id} row={row} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SignInLine({ row }: { row: SignInRow }) {
  const signOut = async (): Promise<void> => {
    if (await confirm({ ...row.signOutQuestion, danger: true })) void api.issueTrackers.signOut(row.id);
  };
  return (
    <li className={styles.listRow}>
      <TrackerIcon kind={row.kind} size={24} />
      <div className={styles.personText}>
        <span className={styles.personName}>
          {row.title}
          {row.usedHere && <span className={styles.badge}>This repository</span>}
        </span>
        <span className={styles.personDetail}>{row.account}</span>
      </div>
      <span className={styles.listDetail}>
        <StatusPill status={row.status} />
      </span>
      <Button size="small" variant="ghost" title={row.signOut} onClick={() => void signOut()}>
        Sign out
      </Button>
    </li>
  );
}
