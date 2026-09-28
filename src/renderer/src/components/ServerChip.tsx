import { describeServer, splitRepositorySpec } from '../lib/servers';
import { ServerIcon } from './ServerIcon';
import styles from './WorkspaceChip.module.css';

/** Where a workspace's repository lives: the cloud organization or "This computer"; the whole `name@server` in its tooltip. */
export function ServerChip({ repository, className }: { repository: string; className?: string }) {
  const { server } = splitRepositorySpec(repository);
  if (!server) return null;
  return (
    <span className={`${styles.chip} ${className ?? ''}`} data-tip={repository}>
      <ServerIcon server={server} size={11} />
      <span className={styles.text}>{describeServer(server).label}</span>
    </span>
  );
}
