import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { workspacePathOf } from '@shared/domain/place';
import type { RepositoryGuid } from '@shared/domain/stableIds';
import { useIssueTrackerSetup } from '../../../components/issues/useIssueTrackers';
import { EmptyState } from '../../../ui/EmptyState';
import { CenteredSpinner } from '../../../ui/Spinner';
import { repositoryOfPlace } from '../../workspace/placeOrigin';
import { repositoryGuidQuery } from '../../workspace/repositoryGuid';
import { useSession } from '../../workspace/sessionStore';
import { useWorkspaceInfoOf } from '../../workspace/useWorkspace';
import { connectedTrackerOf, issueTrackerPaneView, repositoryTrackerView } from './connectFlow';
import { ConnectTracker, type ConnectStart } from './ConnectTracker';
import { RepositoryStart } from './RepositoryStart';
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
  const spec = place ? repositoryOfPlace(place, info) : undefined;
  // What a repository uses is kept by its GUID (ARCHITECTURE.md "Settings survive renames").
  const guid = useQuery({ ...repositoryGuidQuery(spec ?? ''), enabled: spec !== undefined });
  const setup = useIssueTrackerSetup();
  const view = issueTrackerPaneView({ setupRead: setup !== undefined, inPlace: place !== null, spec, guid });
  if (view.kind === 'reading') return <CenteredSpinner />;
  if (view.kind === 'guidUnread') return <EmptyState title="Couldn't read this repository" description={view.reason} />;
  return <div className={styles.pane}>{view.kind === 'repository' ? <RepositoryTracker repository={view.guid} /> : <SignInAlone />}</div>;
}

/**
 * The repository's tracker: with none yet (or changing it), its starting card (`RepositoryStart`: a sign-in to use, or
 * one to add), then Connect from what was picked; once it has one, its card, and the sign-ins quietly under it.
 */
function RepositoryTracker({ repository }: { repository: RepositoryGuid }) {
  const setup = useIssueTrackerSetup();
  const connected = connectedTrackerOf(setup, repository);
  const [changing, setChanging] = useState(false);
  const [start, setStart] = useState<ConnectStart | null>(null);
  const connectedNow = (): void => {
    setStart(null);
    setChanging(false);
  };

  const view = repositoryTrackerView({ start, connected, changing });
  if (view.kind === 'connect') return <ConnectTracker key={JSON.stringify(view.start)} repository={repository} start={view.start} onConnected={connectedNow} onCancel={() => setStart(null)} />;
  if (view.kind === 'start') return <RepositoryStart repository={repository} onStart={setStart} {...(view.changingFrom && { onCancel: () => setChanging(false) })} />;
  return (
    <>
      <TrackerCard repository={repository} connected={view.connected} onChange={() => setChanging(true)} />
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
  if (adding) return <ConnectTracker key={adding} start={{ choice: adding }} onConnected={() => setAdding(null)} onCancel={() => setAdding(null)} />;
  return <SignInsCard onAdd={setAdding} />;
}
