import { LogOut } from 'lucide-react';
import { useState } from 'react';
import type { IssueTrackerKind, ProjectAccess, SignInOutcome } from '@shared/domain/issueTrackers';
import { workspacePathOf } from '@shared/domain/place';
import { TRACKER_GRAMMARS } from '@shared/issueTrackers/trackerGrammars';
import { api } from '../../../api/client';
import { useIssueTrackerSetup } from '../../../components/issues/useIssueTrackers';
import { Button } from '../../../ui/Button';
import { IconButton } from '../../../ui/IconButton';
import { CenteredSpinner } from '../../../ui/Spinner';
import { TextField } from '../../../ui/TextField';
import { repositoryOfPlace } from '../../workspace/placeOrigin';
import { useSession } from '../../workspace/sessionStore';
import { useWorkspaceInfoOf } from '../../workspace/useWorkspace';
import { addProjectReady, connectedTrackerOf, connectFailureWords, proofWords, signInRows } from './connectFlow';
import { ConnectTracker } from './ConnectTracker';
import { SignInAgain } from './SignInAgain';
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
  return repository ? <RepositoryTracker repository={repository} /> : <SignIns />;
}

function RepositoryTracker({ repository }: { repository: string }) {
  const setup = useIssueTrackerSetup();
  const connected = connectedTrackerOf(setup, repository);
  const [changing, setChanging] = useState(false);
  const [proof, setProof] = useState<string | null>(null);
  const done = (outcome: Extract<SignInOutcome, { kind: 'signedIn' }>): void => {
    setChanging(false);
    setProof(outcome.access ? proofWords(outcome.connection, outcome.access) : null);
  };

  if (!connected || changing) {
    return <ConnectTracker repository={repository} onConnected={done} onCancel={connected ? () => setChanging(false) : undefined} />;
  }
  return (
    <section className={styles.step} aria-label="Issue tracker">
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{connected.title}</h2>
        <p className={styles.cardLine}>{connected.account}</p>
        <p className={styles.cardLine}>{proof ?? connected.projects}</p>
        {connected.sessionOnly && <p className={styles.note}>{connected.sessionOnly}</p>}
        {connected.signInAgain && <SignInAgain connection={connected.connection} why={connected.signInAgain} />}
        <div className={styles.row}>
          <Button size="small" onClick={() => setChanging(true)}>
            Change…
          </Button>
          <AddProject repository={repository} kind={connected.connection.kind} onAdded={(access) => setProof(proofWords(connected.connection, access))} />
          <Button size="small" variant="ghost" onClick={() => void api.issueTrackers.disconnect(repository)}>
            Disconnect
          </Button>
        </div>
      </div>
      <p className={styles.note}>Issue keys in this repository’s comments show as chips with their title and status.</p>
    </section>
  );
}

/** Another project of the same tracker, by a link to one of its issues. */
function AddProject({ repository, kind, onAdded }: { repository: string; kind: IssueTrackerKind; onAdded: (access: ProjectAccess) => void }) {
  const [adding, setAdding] = useState(false);
  const [link, setLink] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  if (!adding) {
    return (
      <Button size="small" onClick={() => setAdding(true)}>
        Add a project…
      </Button>
    );
  }
  const add = async (): Promise<void> => {
    const outcome = await api.issueTrackers.addProject({ repository, link });
    if (outcome.kind === 'signedIn') {
      if (outcome.access) onAdded(outcome.access);
      setAdding(false);
      setLink('');
    } else setProblem(connectFailureWords(outcome.failure, { trackerName: TRACKER_GRAMMARS[kind].name }).words);
  };
  return (
    <div className={styles.row}>
      <TextField className={styles.field} aria-label="A link to an issue of the other project" placeholder="Link to an issue of the project" value={link} onChange={(event) => setLink(event.target.value)} />
      <Button size="small" variant="primary" disabled={!addProjectReady(link)} onClick={() => void add()}>
        Add
      </Button>
      {problem && <p className={styles.problem}>{problem}</p>}
    </div>
  );
}

/** The sign-ins this computer keeps, with no repository to connect: each can be signed out of. */
function SignIns() {
  const rows = signInRows(useIssueTrackerSetup());
  return (
    <section className={styles.step} aria-label="Issue tracker sign-ins">
      <p className={styles.intro}>Open a workspace or a repository to connect its issue tracker.</p>
      {rows.length > 0 && (
        <ul className={styles.list}>
          {rows.map((row) => (
            <li key={row.id} className={styles.listRow}>
              <div className={styles.listText}>
                <span>{row.title}</span>
                <span className={styles.listSecondary}>{row.account}</span>
              </div>
              <IconButton icon={<LogOut size={14} />} label={row.signOut} onClick={() => void api.issueTrackers.signOut(row.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
