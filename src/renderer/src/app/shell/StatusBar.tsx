import { TerminalSquare } from 'lucide-react';
import { PathLabel } from '../../components/PathLabel';
import { useIncomingSummary } from '../../features/incoming/useIncomingSummary';
import { ProgressRing } from '../../ui/ProgressRing';
import { navigation } from '../navigation/navigationStore';
import { describeProgress } from '../operations/describeProgress';
import { ringValue } from '../operations/progressBar';
import { useRunningOperation, type RunningOperation } from '../operations/runningOperationsStore';
import { useWorkspaceInfo, useWorkspacePath } from '../workspace/useWorkspace';
import { ranInWorkspace } from './commandLogScope';
import { useCommandLogStore } from './commandLogStore';
import { isUnseenFailure } from './unseenFailure';
import { workspaceContext } from './workspaceContext';
import styles from './StatusBar.module.css';
import { hotkey } from '../../lib/shortcutRegistry';

/**
 * A quiet line at the bottom: where the workspace is and what is running on the left, the command log on the right.
 * The last `cm` command is only a faint hint, shown on hover and while something runs; a failed one leaves a red dot
 * until the command log (which the hint opens) has been looked at, unless the operation that ran it dealt with it.
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
        {running ? (
          <RunningActivity operation={running} />
        ) : (
          context && (
            <>
              <span className={styles.position}>
                {context.position}
                {context.branch && <PathLabel path={context.branch} fitContent />}
              </span>
              {context.sync && <span className={styles.separator}>·</span>}
              {context.behind > 0 ? (
                <button className={styles.behind} onClick={() => navigation.goToView('incoming')} data-tip="Review the incoming changesets">
                  {context.sync}
                </button>
              ) : (
                context.sync && <span>{context.sync}</span>
              )}
            </>
          )
        )}
      </div>
      <button
        className={styles.log}
        data-failed={Boolean(failure)}
        onClick={toggleCommandLog}
        data-tip={failure ? 'A command failed: show the command log' : 'Show the command log'}
        data-tip-shortcut={hotkey('commandLog')}
        aria-label="Command log"
      >
        {hint && (
          <span className={styles.hint}>
            {hint.commandLine}
            <span className={styles.duration}>{hint.durationMs} ms</span>
          </span>
        )}
        {failure ? <span className={styles.failedDot} /> : <TerminalSquare size={12} />}
      </button>
    </footer>
  );
}

/** The running operation in a line: a ring filling with the bar, the title, then the percentage (fixed width) and the stage. */
function RunningActivity({ operation }: { operation: RunningOperation }) {
  const { bar, progress } = operation;
  const text = describeProgress(progress);
  return (
    <>
      <ProgressRing value={ringValue(bar)} size={11} />
      <span className={styles.activity}>{operation.title}</span>
      <span className={styles.percent}>{bar.mode === 'sweep' ? null : text.percent}</span>
      <span className={styles.detail}>{text.stage}</span>
    </>
  );
}
