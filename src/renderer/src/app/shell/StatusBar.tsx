import { TerminalSquare } from 'lucide-react';
import { PathLabel } from '../../components/PathLabel';
import { useIncomingSummary } from '../../features/incoming/useIncomingSummary';
import { Spinner } from '../../ui/Spinner';
import { navigation } from '../navigation/navigationStore';
import { useRunningOperation } from '../operations/runningOperationsStore';
import { useWorkspaceInfo, useWorkspacePath } from '../workspace/useWorkspace';
import { ranInWorkspace } from './commandLogScope';
import { useCommandLogStore } from './commandLogStore';
import { workspaceContext } from './workspaceContext';
import styles from './StatusBar.module.css';
import { hotkey } from '../../lib/shortcutRegistry';

/**
 * A quiet line at the bottom: where the workspace is and what is running on the left, the command log on the right.
 * The last `cm` command is only a faint hint, shown on hover and while something runs; a failed one leaves a red dot
 * until the command log (which the hint opens) has been looked at.
 */
export function StatusBar() {
  const workspacePath = useWorkspacePath();
  const { data: info } = useWorkspaceInfo();
  const { data: summary } = useIncomingSummary();
  const running = useRunningOperation(workspacePath);
  const lastCommand = useCommandLogStore((state) => state.entries.findLast((entry) => ranInWorkspace(entry, workspacePath)));
  const failure = useCommandLogStore((state) =>
    state.open ? undefined : state.entries.findLast((entry) => entry.exitCode !== 0 && entry.id > state.seenUpTo && ranInWorkspace(entry, workspacePath)),
  );
  const toggleCommandLog = useCommandLogStore((state) => state.toggle);
  const context = info && workspaceContext(info, summary);
  const hint = failure ?? lastCommand;

  return (
    <footer className={styles.statusBar} data-busy={Boolean(running)}>
      <div className={styles.context}>
        {running ? (
          <>
            <Spinner size={10} />
            <span className={styles.activity}>{running.title}</span>
            {running.detail && <span className={styles.detail}>{running.detail}</span>}
          </>
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
