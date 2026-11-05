import { useState } from 'react';
import { workspacePathOf } from '@shared/domain/place';
import { useIssueTrackerSetup } from '../../../components/issues/useIssueTrackers';
import { CenteredSpinner } from '../../../ui/Spinner';
import { repositoryOfPlace } from '../../workspace/placeOrigin';
import { useSession } from '../../workspace/sessionStore';
import { useWorkspaceInfoOf } from '../../workspace/useWorkspace';
import { connectedTrackerOf } from './connectFlow';
import { ConnectTracker } from './ConnectTracker';
import { SignInsCard } from './SignInsCard';
import { TrackerCard } from './TrackerCard';
import type { TrackerChoice } from './trackerChoices';
import styles from './IssueTrackerPane.module.css';

/**
 * Settings › Issue tracker (docs/features/issue-trackers.md, "Connecting"), the same in every window: the window's
 * repository's tracker, connected by picking it and pasting a link to one of its issues; under it, the sign-ins this
 * computer keeps (`SignInsCard`), which are all a window with no repository shows.
 */
export function IssueTrackerPane() {
  const place = useSession((state) => state.place);
  const info = useWorkspaceInfoOf(place ? workspacePathOf(place) : null).data;
  const repository = place ? repositoryOfPlace(place, info) : undefined;
  const setup = useIssueTrackerSetup();
  if (!setup || (place && !repository)) return <CenteredSpinner />;
  return (
    <div className={styles.pane}>
      {repository ? <RepositoryTracker repository={repository} /> : <SignInAlone />}
    </div>
  );
}

/**
 * Connect while the repository has no tracker (or the user is changing it), alone, so nothing else competes with its
 * steps; once it has one, its card, and the sign-ins this computer keeps quietly under it.
 */
function RepositoryTracker({ repository }: { repository: string }) {
  const setup = useIssueTrackerSetup();
  const connected = connectedTrackerOf(setup, repository);
  const [changing, setChanging] = useState(false);

  if (!connected || changing) {
    return <ConnectTracker repository={repository} onConnected={() => setChanging(false)} onCancel={connected ? () => setChanging(false) : undefined} />;
  }
  return (
    <>
      <TrackerCard repository={repository} connected={connected} onChange={() => setChanging(true)} />
      <SignInsCard repository={repository} />
    </>
  );
}

/**
 * A window with no repository: the sign-ins this computer keeps, always (none yet says so); "Add a sign-in" offers the
 * trackers in a menu, and the one picked opens Connect at its link step, to sign in alone (any repository then
 * connects to it in one click). Back, or signing in, returns to the sign-ins.
 */
function SignInAlone() {
  const [adding, setAdding] = useState<TrackerChoice | null>(null);
  if (adding) return <ConnectTracker key={adding} startWith={adding} onConnected={() => setAdding(null)} onCancel={() => setAdding(null)} />;
  return <SignInsCard onAdd={setAdding} />;
}
