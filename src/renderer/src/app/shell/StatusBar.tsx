import { spec } from '@shared/domain/specs';
import { ArrowDownToLine, Check, GitCommitVertical, TerminalSquare } from 'lucide-react';
import { useIncomingSummary } from '../../features/incoming/useIncomingSummary';
import { copyToClipboard } from '../../lib/copyToClipboard';
import { hotkey } from '../../lib/shortcutRegistry';
import { ProgressRing } from '../../ui/ProgressRing';
import { navigation } from '../navigation/navigationStore';
import { describeMeasures, describeProgress } from '../operations/describeProgress';
import { ringValue } from '../operations/progressBar';
import { useRunningOperation, type RunningOperation } from '../operations/runningOperationsStore';
import { useWorkspaceInfo, useWorkspacePath } from '../workspace/useWorkspace';
import { CommandHint } from './CommandHint';
import { ranInWorkspace } from './commandLogScope';
import { useCommandLogStore } from './commandLogStore';
import { isUnseenFailure } from './unseenFailure';
import { workspaceContext, type SyncState } from './workspaceContext';
import styles from './StatusBar.module.css';

/**
 * A quiet line at the bottom. On the left, the loaded changeset (the branch is the top bar's), then what is running or
 * whether the branch moved on. On the right, the command log: the last `cm` command is only a faint hint, shown on
 * hover and while something runs; a failed one leaves a red dot until the log (which the hint opens) has been looked
 * at, unless the operation that ran it dealt with it.
 */
export function StatusBar() {
  const workspacePath = useWorkspacePath();
  const { data: info } = useWorkspaceInfo();
  const { data: summary } = useIncomingSummary();
  const running = useRunningOperation(workspacePath);
  const lastCommand = useCommandLogStore((state) => state.entries.findLast((entry) => ranInWorkspace(entry, workspacePath)));
  const failure = useCommandLogStore((state) =>
    state.open ? undefined : state.entries.findLast((entry) => isUnseenFailure(entry, state.seenUpTo, state.handledIds) && ranInWorkspace(entry, workspacePath)),
  );
  const toggleCommandLog = useCommandLogStore((state) => state.toggle);
  const context = info && workspaceContext(info, summary);
  const hint = failure ?? lastCommand;

  return (
    <footer className={styles.statusBar} data-busy={Boolean(running)}>
      <div className={styles.context}>
        {context && info && (
          <button
            className={styles.item}
            onClick={() => copyToClipboard(spec.changeset(info.loadedChangeset), 'Changeset spec')}
            data-tip={context.description}
            data-tip-sub={`${context.repository} · Click to copy ${context.changeset}`}
          >
            <GitCommitVertical size={12} className={styles.icon} />
            <span className={styles.changeset}>{context.changeset}</span>
          </button>
        )}
        {running ? <RunningActivity operation={running} /> : context?.sync && <SyncItem sync={context.sync} />}
      </div>
      <button
        className={styles.log}
        data-failed={Boolean(failure)}
        onClick={toggleCommandLog}
        data-tip={failure ? 'A command failed: show the command log' : 'Show the command log'}
        data-tip-shortcut={hotkey('commandLog')}
        aria-label="Command log"
      >
        {hint && <CommandHint entry={hint} />}
        <span className={styles.logIcon}>
          <TerminalSquare size={12} />
          {failure && <span className={styles.failedDot} />}
        </span>
      </button>
    </footer>
  );
}

/** "Up to date", quietly; changesets to come in lead to Incoming. */
function SyncItem({ sync }: { sync: SyncState }) {
  if (sync.kind === 'upToDate') {
    return (
      <span className={styles.item} data-tip={sync.tip}>
        <Check size={12} className={styles.upToDate} />
        {sync.label}
      </span>
    );
  }
  return (
    <button className={`${styles.item} ${styles.incoming}`} onClick={() => navigation.goToView('incoming')} data-tip={sync.tip}>
      <ArrowDownToLine size={12} />
      {sync.label}
    </button>
  );
}

/**
 * The running operation in a line: a ring filling with the bar, the title, then the percentage (fixed width) and the
 * stage; the bytes it has no room for go in the tooltip, with the files.
 */
function RunningActivity({ operation }: { operation: RunningOperation }) {
  const { bar, progress } = operation;
  const text = describeProgress(progress);
  return (
    <span className={`${styles.item} ${styles.running}`} role="status" data-tip={describeMeasures(text) ?? undefined}>
      <ProgressRing value={ringValue(bar)} size={12} />
      <span className={styles.activity}>{operation.title}</span>
      <span className={styles.percent}>{bar.mode === 'sweep' ? null : text.percent}</span>
      <span className={styles.detail}>{text.stage}</span>
    </span>
  );
}
