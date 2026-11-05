import { LogOut } from 'lucide-react';
import { useState } from 'react';
import type { ProjectAccess, SignInOutcome } from '@shared/domain/issueTrackers';
import { workspacePathOf } from '@shared/domain/place';
import { api } from '../../../api/client';
import { useIssueTrackerSetup } from '../../../components/issues/useIssueTrackers';
import { IconButton } from '../../../ui/IconButton';
import { CenteredSpinner } from '../../../ui/Spinner';
import { repositoryOfPlace } from '../../workspace/placeOrigin';
import { useSession } from '../../workspace/sessionStore';
import { useWorkspaceInfoOf } from '../../workspace/useWorkspace';
import { connectedTrackerOf, signInRows } from './connectFlow';
import { ConnectTracker } from './ConnectTracker';
import { StatusPill } from './StatusPill';
import { TrackerCard } from './TrackerCard';
import { TrackerIcon } from './TrackerIcon';
import styles from './IssueTrackerPane.module.css';

/**
 * Settings › Issue tracker (docs/features/issue-trackers.md, "Connecting"): the window's repository's tracker, connected
 * by pasting a link to one of its issues; in a window with no repository, the sign-ins this computer keeps.
 */
export function IssueTrackerPane() {
  const place = useSession((state) => state.place);
  const info = useWorkspaceInfoOf(place ? workspacePathOf(place) : null).data;
  const repository = place ? repositoryOfPlace(place, info) : undefined;
  const setup = useIssueTrackerSetup();
  if (!setup || (place && !repository)) return <CenteredSpinner />;
  return <div className={styles.pane}>{repository ? <RepositoryTracker repository={repository} /> : <SignIns />}</div>;
}

/** Connect while the repository has no tracker (or the user is changing it); the connected card once it has. */
function RepositoryTracker({ repository }: { repository: string }) {
  const setup = useIssueTrackerSetup();
  const connected = connectedTrackerOf(setup, repository);
  const [changing, setChanging] = useState(false);
  const [justConnected, setJustConnected] = useState<ProjectAccess | 'noProof' | null>(null);
  const done = (outcome: Extract<SignInOutcome, { kind: 'signedIn' }>): void => {
    setChanging(false);
    setJustConnected(outcome.access ?? 'noProof');
  };

  if (!connected || changing) {
    return <ConnectTracker repository={repository} onConnected={done} onCancel={connected ? () => setChanging(false) : undefined} />;
  }
  return <TrackerCard repository={repository} connected={connected} justConnected={justConnected} onSettled={() => setJustConnected(null)} onChange={() => setChanging(true)} />;
}

/** The sign-ins this computer keeps, with no repository to connect: each with how it stands, and Sign out. */
function SignIns() {
  const rows = signInRows(useIssueTrackerSetup());
  return (
    <section className={styles.card} aria-label="Issue tracker sign-ins">
      <header className={styles.cardHeader}>
        <TrackerIcon kind={null} />
        <div className={styles.cardHeaderText}>
          <h2 className={styles.cardTitle}>Issue tracker sign-ins</h2>
          <span className={styles.cardSubtitle}>Open a workspace or a repository to connect its tracker.</span>
        </div>
      </header>
      <div className={styles.section}>
        {rows.length === 0 && <p className={styles.note}>No sign-ins on this computer yet.</p>}
        {rows.length > 0 && (
          <ul className={styles.list}>
            {rows.map((row) => (
              <li key={row.id} className={styles.listRow}>
                <TrackerIcon kind={row.kind} size={22} />
                <div className={styles.personText}>
                  <span className={styles.personName}>{row.title}</span>
                  <span className={styles.personDetail}>{row.account}</span>
                </div>
                <span className={styles.listDetail}>
                  <StatusPill status={row.status} />
                </span>
                <IconButton className={styles.rowAction} size="small" icon={<LogOut size={14} />} label={row.signOut} onClick={() => void api.issueTrackers.signOut(row.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
