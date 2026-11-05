import { Check, MoreHorizontal } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ProjectAccess } from '@shared/domain/issueTrackers';
import { api } from '../../../api/client';
import { SEPARATOR, type MenuEntry } from '../../../lib/actions';
import { Avatar } from '../../../ui/Avatar';
import { confirm } from '../../../ui/dialog/confirm';
import { IconButton } from '../../../ui/IconButton';
import { ActionDropdownMenu } from '../../../ui/menu/ActionDropdownMenu';
import type { ConnectedTracker } from './connectFlow';
import { ProjectsSection } from './ProjectsSection';
import { ProofLines } from './ProofLines';
import { SignInAgain } from './SignInAgain';
import { StatusPill } from './StatusPill';
import { accountLines, disconnectQuestion, needsSignIn, proofLines, SUCCESS_SHOWN_MS, trackerHeader, trackerStatus, unreachableWords } from './trackerCardContent';
import { Button } from '../../../ui/Button';
import { TrackerIcon } from './TrackerIcon';
import { useBoundProjects } from './useBoundProjects';
import styles from './IssueTrackerPane.module.css';

interface TrackerCardProps {
  repository: string;
  connected: ConnectedTracker;
  /** Just connected: the proof of it, shown a moment as the card's success before it settles. */
  justConnected: ProjectAccess | 'noProof' | null;
  onSettled: () => void;
  /** "Use another tracker…": back to Connect. */
  onChange: () => void;
}

/**
 * The repository's tracker, connected (docs/features/issue-trackers.md, "Connecting"): the tracker and how it stands
 * in the header (`trackerStatus`), with its menu; signing in again when needed; who is signed in; the projects.
 */
export function TrackerCard({ repository, connected, justConnected, onSettled, onChange }: TrackerCardProps) {
  const { connection } = connected;
  const signInNeeded = needsSignIn(connection);
  const projects = useBoundProjects(repository, connection, connected.projectKeys, !signInNeeded);
  const status = trackerStatus(connection, projects.data);
  const header = trackerHeader(connection);
  const account = accountLines(connection.account);
  const entries = (): MenuEntry[] => [
    { id: 'useAnother', label: 'Use another tracker…', run: onChange },
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
      {justConnected && <Connected connected={connected} access={justConnected === 'noProof' ? undefined : justConnected} onSettled={onSettled} />}
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
            <p className={styles.calloutTitle}>{unreachableWords(connection).title}</p>
            <p className={styles.intro}>{unreachableWords(connection).detail}</p>
            <div className={styles.row}>
              <Button size="small" loading={projects.isFetching} onClick={() => void projects.refetch()}>
                Try again
              </Button>
            </div>
          </div>
        </div>
      )}
      {!justConnected && (
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
      )}
      <ProjectsSection repository={repository} kind={connection.kind} projects={connected.projectKeys} answer={projects.data} />
    </section>
  );
}

/** The moment of success: a green callout with the proof, which rises in once and settles after a while. */
function Connected({ connected, access, onSettled }: { connected: ConnectedTracker; access: ProjectAccess | undefined; onSettled: () => void }) {
  // The latest callback, so the timer starts once, as the callout arrives, whatever renders meanwhile.
  const settled = useRef(onSettled);
  settled.current = onSettled;
  useEffect(() => {
    const timer = setTimeout(() => settled.current(), SUCCESS_SHOWN_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className={styles.section}>
      <div className={`${styles.callout} ${styles.arrives}`} data-tone="positive" role="status">
        <p className={styles.calloutTitle}>
          <Check size={16} strokeWidth={2.5} aria-hidden />
          Connected to {trackerHeader(connected.connection).name}
        </p>
        <ProofLines lines={proofLines(connected.connection, access)} />
      </div>
    </div>
  );
}
