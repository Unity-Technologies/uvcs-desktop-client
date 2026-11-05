import { MoreHorizontal } from 'lucide-react';
import { api } from '../../../api/client';
import { SEPARATOR, type MenuEntry } from '../../../lib/actions';
import { Avatar } from '../../../ui/Avatar';
import { confirm } from '../../../ui/dialog/confirm';
import { IconButton } from '../../../ui/IconButton';
import { ActionDropdownMenu } from '../../../ui/menu/ActionDropdownMenu';
import { ProjectsSection } from './ProjectsSection';
import { SignInAgain } from './SignInAgain';
import { StatusPill } from './StatusPill';
import { needsSignIn, type ConnectedTracker } from './connectFlow';
import { accountLines, disconnectQuestion, trackerHeader, trackerStatus, unreachableWords } from './trackerCardContent';
import { Button } from '../../../ui/Button';
import { TrackerIcon } from './TrackerIcon';
import { useBoundProjects } from './useBoundProjects';
import styles from './IssueTrackerPane.module.css';

interface TrackerCardProps {
  repository: string;
  connected: ConnectedTracker;
  /** "Change tracker…": back to Connect, to replace it (a repository has one tracker). */
  onChange: () => void;
}

/**
 * The repository's tracker, connected (docs/features/issue-trackers.md, "Connecting"): the tracker and how it stands
 * in the header (`trackerStatus`), with its menu; signing in again when needed; who is signed in; the projects.
 */
export function TrackerCard({ repository, connected, onChange }: TrackerCardProps) {
  const { connection } = connected;
  const signInNeeded = needsSignIn(connection);
  const projects = useBoundProjects(repository, connection, connected.projectKeys, !signInNeeded);
  const status = trackerStatus(connection, projects.data);
  const header = trackerHeader(connection);
  const unreachable = unreachableWords(connection);
  const account = accountLines(connection.account);
  const entries = (): MenuEntry[] => [
    { id: 'changeTracker', label: 'Change tracker…', run: onChange },
    SEPARATOR,
    {
      id: 'disconnect',
      label: 'Disconnect…',
      danger: true,
      run: () => {
        void confirm({ ...disconnectQuestion(header.name), danger: true }).then((sure) => {
          if (sure) void api.issueTrackers.disconnect(repository);
        });
      },
    },
  ];

  return (
    <section className={styles.card} aria-label="Issue tracker">
      <header className={styles.cardHeader}>
        <TrackerIcon kind={connection.kind} />
        <div className={styles.cardHeaderText}>
          <h2 className={styles.cardTitle}>{header.name}</h2>
          <span className={styles.cardSubtitle}>
            {header.kindName} · {header.host}
          </span>
        </div>
        <StatusPill status={status} />
        <ActionDropdownMenu entries={entries}>
          <IconButton size="small" icon={<MoreHorizontal size={15} />} label="More" />
        </ActionDropdownMenu>
      </header>
      {connected.signInAgain && (
        <div className={styles.section}>
          <div className={styles.callout} data-tone="caution">
            <SignInAgain connection={connection} why={connected.signInAgain} />
          </div>
        </div>
      )}
      {status.tone === 'danger' && (
        <div className={styles.section}>
          <div className={styles.callout} data-tone="danger" role="alert">
            <p className={styles.calloutTitle}>{unreachable.title}</p>
            <p className={styles.intro}>{unreachable.detail}</p>
            <div className={styles.row}>
              <Button size="small" loading={projects.isFetching} onClick={() => void projects.refetch()}>
                Try again
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Account</h3>
        <div className={styles.person}>
          <Avatar user={account.name} size={28} tip={null} />
          <div className={styles.personText}>
            <span className={styles.personName}>{account.name}</span>
            {account.detail && <span className={styles.personDetail}>{account.detail}</span>}
          </div>
        </div>
        {connected.sessionOnly && <p className={styles.note}>{connected.sessionOnly}</p>}
      </div>
      <ProjectsSection repository={repository} kind={connection.kind} projects={connected.projectKeys} answer={projects.data} />
    </section>
  );
}
