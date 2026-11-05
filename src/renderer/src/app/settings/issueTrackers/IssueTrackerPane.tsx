import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { ProjectAccess, SignInOutcome } from '@shared/domain/issueTrackers';
import { workspacePathOf } from '@shared/domain/place';
import { useIssueTrackerSetup } from '../../../components/issues/useIssueTrackers';
import { Button } from '../../../ui/Button';
import { CenteredSpinner } from '../../../ui/Spinner';
import { repositoryOfPlace } from '../../workspace/placeOrigin';
import { useSession } from '../../workspace/sessionStore';
import { useWorkspaceInfoOf } from '../../workspace/useWorkspace';
import { connectedTrackerOf } from './connectFlow';
import { ConnectTracker } from './ConnectTracker';
import { SignInsCard } from './SignInsCard';
import { TrackerCard } from './TrackerCard';
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
      {(repository || setup.connections.length > 0) && <SignInsCard {...(repository && { repository })} />}
    </div>
  );
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

/**
 * A window with no repository: with no sign-in yet, Connect itself, to sign in alone (any repository then connects in
 * one click); once there are sign-ins, "Add a sign-in" over them opens it again.
 */
function SignInAlone() {
  const signIns = useIssueTrackerSetup()?.connections.length ?? 0;
  const [adding, setAdding] = useState(false);
  if (signIns === 0 || adding) return <ConnectTracker onConnected={() => setAdding(false)} {...(signIns > 0 && { onCancel: () => setAdding(false) })} />;
  return (
    <div className={styles.row}>
      <Button size="small" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
        Add a sign-in
      </Button>
    </div>
  );
}
