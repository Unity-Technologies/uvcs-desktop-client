import { RefreshCcw } from 'lucide-react';
import { useState } from 'react';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { Button } from '../../ui/Button';
import { TextField } from '../../ui/TextField';
import { syncWithGit } from './syncOperations';
import styles from './SyncView.module.css';

/** Two-way sync between the workspace repository and a Git remote (`cm sync`). */
export function GitSyncPanel({ localRepository }: { localRepository: string }) {
  const workspacePath = useWorkspacePath();
  const [url, setUrl] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [syncing, setSyncing] = useState(false);

  const sync = async (): Promise<void> => {
    if (!url.trim()) return;
    setSyncing(true);
    await syncWithGit(workspacePath, { repository: localRepository, url: url.trim(), user: user.trim() || undefined, password: password || undefined });
    setSyncing(false);
  };

  return (
    <form
      className={styles.gitForm}
      onSubmit={(event) => {
        event.preventDefault();
        void sync();
      }}
    >
      <p className={styles.explanation}>
        Pulls new commits from the Git repository into <b>{localRepository}</b> and pushes the changesets Git doesn't have yet.
      </p>
      <TextField label="Git repository URL" placeholder="https://github.com/org/project.git" value={url} onChange={(event) => setUrl(event.target.value)} autoFocus />
      <div className={styles.credentials}>
        <TextField label="User (optional)" value={user} onChange={(event) => setUser(event.target.value)} />
        <TextField label="Password or token (optional)" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>
      <div>
        <Button type="submit" variant="primary" icon={<RefreshCcw size={14} />} disabled={!url.trim()} loading={syncing}>
          Sync now
        </Button>
      </div>
    </form>
  );
}
