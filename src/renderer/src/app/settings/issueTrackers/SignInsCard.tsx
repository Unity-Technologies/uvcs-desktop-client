import { Plus } from 'lucide-react';
import { api } from '../../../api/client';
import { useIssueTrackerSetup } from '../../../components/issues/useIssueTrackers';
import { Button } from '../../../ui/Button';
import { confirm } from '../../../ui/dialog/confirm';
import { signInRows, type SignInRow } from './connectFlow';
import { StatusPill } from './StatusPill';
import { TrackerIcon } from './TrackerIcon';
import styles from './IssueTrackerPane.module.css';

/**
 * The sign-ins this computer keeps (docs/features/issue-trackers.md, "Connecting"), with Sign out in every window. In
 * a window with no repository they're the pane: a card, "Add a sign-in" in its header, each row with its logo, account
 * and how it stands. Under a
 * repository's connected tracker they're a quiet list: a small title, compact rows, the one the repository uses
 * marked, a status only when one needs signing in again, and Sign out on the row pointed at.
 */
export function SignInsCard({ repository, onAdd }: { repository?: string; onAdd?: () => void }) {
  const rows = signInRows(useIssueTrackerSetup(), repository);
  if (repository) {
    return (
      <section className={styles.quietSection} aria-label="Sign-ins on this computer">
        <h3 className={styles.quietTitle}>Sign-ins on this computer</h3>
        <ul className={styles.quietList}>
          {rows.map((row) => (
            <QuietSignInLine key={row.id} row={row} />
          ))}
        </ul>
      </section>
    );
  }
  return (
    <section className={styles.card} aria-label="Issue tracker sign-ins">
      <header className={styles.cardHeader}>
        <div className={styles.cardHeaderText}>
          <h2 className={styles.cardTitle}>Issue tracker sign-ins</h2>
          <span className={styles.cardSubtitle}>Any repository connects to them in one click.</span>
        </div>
        {onAdd && (
          <Button size="small" icon={<Plus size={14} />} onClick={onAdd}>
            Add a sign-in
          </Button>
        )}
      </header>
      <div className={styles.section}>
        <ul className={styles.list}>
          {rows.map((row) => (
            <SignInLine key={row.id} row={row} />
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Sign out, asked first: the repositories that use the sign-in lose their tracker (`signOutQuestion`). */
function useSignOut(row: SignInRow): () => void {
  return () => {
    void confirm({ ...row.signOutQuestion, danger: true }).then((sure) => {
      if (sure) void api.issueTrackers.signOut(row.id);
    });
  };
}

function SignInLine({ row }: { row: SignInRow }) {
  const signOut = useSignOut(row);
  return (
    <li className={styles.listRow}>
      <TrackerIcon kind={row.kind} size={24} />
      <div className={styles.personText}>
        <span className={styles.personName}>{row.title}</span>
        <span className={styles.personDetail}>{row.account}</span>
      </div>
      <span className={styles.listDetail}>
        <StatusPill status={row.status} />
      </span>
      <Button size="small" variant="ghost" title={row.signOut} onClick={signOut}>
        Sign out
      </Button>
    </li>
  );
}

function QuietSignInLine({ row }: { row: SignInRow }) {
  const signOut = useSignOut(row);
  return (
    <li className={styles.quietRow}>
      <TrackerIcon kind={row.kind} size={18} />
      <span className={styles.quietText}>
        {row.title}
        <span className={styles.quietAccount}> · {row.account}</span>
      </span>
      {row.usedHere && <span className={styles.quietTag}>This repository</span>}
      {row.needsAttention && <StatusPill status={row.status} />}
      <Button className={styles.rowAction} size="small" variant="ghost" title={row.signOut} onClick={signOut}>
        Sign out
      </Button>
    </li>
  );
}
