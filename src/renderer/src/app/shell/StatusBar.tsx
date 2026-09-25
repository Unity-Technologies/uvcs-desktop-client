import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { UserLabel } from '../../ui/Avatar';
import { useCommandLogStore } from './commandLogStore';
import styles from './StatusBar.module.css';

export function StatusBar() {
  const { data: user } = useQuery({ queryKey: queryKeys.user, queryFn: () => api.system.currentUser(), staleTime: Infinity });
  const lastCommand = useCommandLogStore((state) => state.entries.at(-1));
  const toggleCommandLog = useCommandLogStore((state) => state.toggle);

  return (
    <footer className={styles.statusBar}>
      <button className={styles.lastCommand} onClick={toggleCommandLog} data-tip="Show command log">
        {lastCommand && (
          <>
            <span className={styles.dot} data-failed={lastCommand.exitCode !== 0} />
            <span className={styles.command}>{lastCommand.commandLine}</span>
            <span className={styles.duration}>{lastCommand.durationMs} ms</span>
          </>
        )}
      </button>
      {user && <UserLabel user={user} />}
    </footer>
  );
}
