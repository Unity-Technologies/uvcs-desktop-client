import { useIssueTrackerSetup } from '../../../components/issues/useIssueTrackers';
import { Button } from '../../../ui/Button';
import { askToSignOut } from './askToSignOut';
import { signInRows, type SignInRow } from './connectFlow';
import { StatusPill } from './StatusPill';
import { NO_SIGN_INS, type TrackerChoice } from './trackerChoices';
import { AddSignInMenu } from './AddSignInMenu';
import { SignInIdentity } from './SignInIdentity';
import styles from './IssueTrackerPane.module.css';
import tileStyles from './SignInTiles.module.css';

/**
 * The sign-ins this computer keeps (docs/features/issue-trackers.md, "Connecting"), a small card each
 * (`SignInTile`), with Sign out, in every window. In a window with no repository they're the pane, in a card whose
 * header's "Add a sign-in" offers the trackers in a menu, and that says when there's none yet; under a repository's
 * connected tracker, a quiet section with a small title.
 */
export function SignInsCard({ repository, onAdd }: { repository?: string; onAdd?: (choice: TrackerChoice) => void }) {
  const rows = signInRows(useIssueTrackerSetup(), repository);
  const tiles = (
    <ul className={tileStyles.tiles}>
      {rows.map((row) => (
        <SignInTile key={row.id} row={row} />
      ))}
    </ul>
  );
  if (repository) {
    return (
      <section className={tileStyles.quietSection} aria-label="Sign-ins on this computer">
        <h3 className={tileStyles.quietTitle}>Sign-ins on this computer</h3>
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
          <AddSignInMenu onAdd={onAdd} />
        )}
      </header>
      <div className={styles.section}>
        {rows.length > 0 ? (
          tiles
        ) : (
          <div className={tileStyles.noSignIns}>
            <p className={styles.nextTitle}>{NO_SIGN_INS.title}</p>
            <p className={styles.note}>{NO_SIGN_INS.onHome}</p>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * A sign-in as a small, quiet card: who it is first, the avatar with the tracker's logo on its corner, the server
 * under the name with the repository's own said there; a status only when it needs signing in again; Sign out, asked first
 * (`signOutQuestion`: the repositories that use it lose their tracker).
 */
function SignInTile({ row }: { row: SignInRow }) {
  return (
    <li className={tileStyles.signInTile} aria-label={`${row.account}, ${row.title}`}>
      <SignInIdentity row={row} />
      {row.needsAttention && <StatusPill status={row.status} />}
      <Button className={tileStyles.tileAction} size="small" variant="ghost" title={row.signOut} onClick={() => askToSignOut(row)}>
        Sign out
      </Button>
    </li>
  );
}
