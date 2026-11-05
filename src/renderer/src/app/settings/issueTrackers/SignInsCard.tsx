import { Plus } from 'lucide-react';
import type { ReactElement } from 'react';
import { DescribedMenu } from '../../../ui/menu/DescribedMenu';
import { api } from '../../../api/client';
import { useIssueTrackerSetup } from '../../../components/issues/useIssueTrackers';
import { Button } from '../../../ui/Button';
import { confirm } from '../../../ui/dialog/confirm';
import { signInRows, type SignInRow } from './connectFlow';
import { StatusPill } from './StatusPill';
import { TRACKER_CHOICES, type TrackerChoice } from './trackerChoices';
import { TrackerLogo } from './TrackerLogo';
import { SignInIdentity } from './SignInIdentity';
import styles from './IssueTrackerPane.module.css';

/**
 * The sign-ins this computer keeps (docs/features/issue-trackers.md, "Connecting"), a small card each
 * (`SignInTile`), with Sign out, in every window. In a window with no repository they're the pane, in a card whose
 * header's "Add a sign-in" offers the trackers in a menu, and that says when there's none yet; under a repository's
 * connected tracker, a quiet section with a small title.
 */
export function SignInsCard({ repository, onAdd }: { repository?: string; onAdd?: (choice: TrackerChoice) => void }) {
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
          <DescribedMenu items={addSignInItems(onAdd)} iconSize={24}>
            <Button size="small" icon={<Plus size={14} />}>
              Add a sign-in
            </Button>
          </DescribedMenu>
        )}
      </header>
      <div className={styles.section}>
        {rows.length > 0 ? (
          tiles
        ) : (
          <div className={styles.noSignIns}>
            <p className={styles.nextTitle}>No sign-ins yet</p>
            <p className={styles.note}>Add one with your Jira or GitHub account. Any repository then connects to it in one click.</p>
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
  const signOut = (): void => {
    void confirm({ ...row.signOutQuestion, danger: true }).then((sure) => {
      if (sure) void api.issueTrackers.signOut(row.id);
    });
  };
  return (
    <li className={styles.signInTile} aria-label={`${row.account}, ${row.title}`}>
      <SignInIdentity row={row} detail={row.usedHere ? `${row.host} · This repository` : row.host} />
      {row.needsAttention && <StatusPill status={row.status} />}
      <Button className={styles.tileAction} size="small" variant="ghost" title={row.signOut} onClick={signOut}>
        Sign out
      </Button>
    </li>
  );
}

/** "Add a sign-in"'s menu: a tracker each, its logo, its name and, under it, its servers (`TRACKER_CHOICES`). */
function addSignInItems(onAdd: (choice: TrackerChoice) => void) {
  return TRACKER_CHOICES.map((card) => ({ id: `add-${card.choice}`, label: card.name, description: card.servers, icon: LOGO_ICONS[card.choice], run: () => onAdd(card.choice) }));
}

/** Each tracker's logo as a menu's icon, at the size the menu asks. */
const LOGO_ICONS: Record<TrackerChoice, (props: { size?: number }) => ReactElement> = {
  jira: ({ size = 16 }) => <TrackerLogo choice="jira" size={size} />,
  github: ({ size = 16 }) => <TrackerLogo choice="github" size={size} />,
};
