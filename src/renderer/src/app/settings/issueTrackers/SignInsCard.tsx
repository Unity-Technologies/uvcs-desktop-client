import { Plus } from 'lucide-react';
import { api } from '../../../api/client';
import { useIssueTrackerSetup } from '../../../components/issues/useIssueTrackers';
import { Avatar } from '../../../ui/Avatar';
import { Button } from '../../../ui/Button';
import { confirm } from '../../../ui/dialog/confirm';
import { signInRows, type SignInRow } from './connectFlow';
import { StatusPill } from './StatusPill';
import { TrackerIcon } from './TrackerIcon';
import styles from './IssueTrackerPane.module.css';

/**
 * The sign-ins this computer keeps (docs/features/issue-trackers.md, "Connecting"), a small card each
 * (`SignInTile`), with Sign out, in every window. In a window with no repository they're the pane, in a card whose
 * header adds one; under a repository's connected tracker, a quiet section with a small title.
 */
export function SignInsCard({ repository, onAdd }: { repository?: string; onAdd?: () => void }) {
  const rows = signInRows(useIssueTrackerSetup(), repository);
  const tiles = (
    <ul className={styles.tiles}>
      {rows.map((row) => (
        <SignInTile key={row.id} row={row} />
      ))}
    </ul>
  );
  if (repository) {
    return (
      <section className={styles.quietSection} aria-label="Sign-ins on this computer">
        <h3 className={styles.quietTitle}>Sign-ins on this computer</h3>
        {tiles}
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
      <div className={styles.section}>{tiles}</div>
    </section>
  );
}

/**
 * A sign-in as a small, quiet card: who it is first, the avatar with the tracker's logo on its corner, the server
 * under the name with the repository's own said there; a status only when it needs signing in again; Sign out, asked first
 * (`signOutQuestion`: the repositories that use it lose their tracker).
 */
function SignInTile({ row }: { row: SignInRow }) {
  const signOut = (): void => {
    void confirm({ ...row.signOutQuestion, danger: true }).then((sure) => {
      if (sure) void api.issueTrackers.signOut(row.id);
    });
  };
  return (
    <li className={styles.signInTile} aria-label={`${row.account}, ${row.title}`}>
      <span className={styles.tileAvatar}>
        <Avatar user={row.account} size={26} tip={null} />
        <span className={styles.tileBadge}>
          <TrackerIcon kind={row.kind} size={13} />
        </span>
      </span>
      <span className={styles.tileText}>
        <span className={styles.tileName}>{row.account}</span>
        <span className={styles.tileHost}>
          {row.host}
          {row.usedHere && ' · This repository'}
        </span>
      </span>
      {row.needsAttention && <StatusPill status={row.status} />}
      <Button className={styles.tileAction} size="small" variant="ghost" title={row.signOut} onClick={signOut}>
        Sign out
      </Button>
    </li>
  );
}
