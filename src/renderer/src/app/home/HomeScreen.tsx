import { useQuery } from '@tanstack/react-query';
import { FolderOpen, FolderPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { Button } from '../../ui/Button';
import { CenteredSpinner } from '../../ui/Spinner';
import { SearchField } from '../../ui/SearchField';
import { toast } from '../../ui/toast/toastStore';
import { rememberRecentWorkspace, useSettings } from '../settings/useSettings';
import { useSession } from '../workspace/sessionStore';
import styles from './HomeScreen.module.css';

export function HomeScreen() {
  const [filter, setFilter] = useState('');
  const { recentWorkspacePaths } = useSettings();
  const { data: workspaces, isLoading } = useQuery({ queryKey: queryKeys.workspaces, queryFn: () => api.workspaces.list() });
  const open = useOpenWorkspace();

  const sorted = useMemo(() => sortByRecent(workspaces ?? [], recentWorkspacePaths), [workspaces, recentWorkspacePaths]);
  const visible = sorted.filter((workspace) => `${workspace.name} ${workspace.path}`.toLowerCase().includes(filter.toLowerCase()));

  const openFolder = async (): Promise<void> => {
    const directory = await api.system.pickDirectory('Open a workspace folder');
    if (!directory) return;
    const root = await api.workspaces.findRoot(directory);
    if (root) open(root);
    else toast.error('That folder is not inside a workspace');
  };

  return (
    <div className={styles.home}>
      <div className={styles.dragRegion} />
      <div className={styles.card}>
        <header className={styles.header}>
          <div className={styles.logo}>◆</div>
          <div>
            <h1 className={styles.title}>Unity Version Control</h1>
            <p className={styles.subtitle}>Pick a workspace to start working.</p>
          </div>
        </header>

        <div className={styles.toolbar}>
          <SearchField value={filter} onChange={setFilter} placeholder="Find a workspace" autoFocus width={260} />
          <div className={styles.spacer} />
          <Button icon={<FolderOpen size={14} />} onClick={() => void openFolder()}>
            Open folder…
          </Button>
          <Button variant="primary" icon={<FolderPlus size={14} />} disabled>
            New workspace
          </Button>
        </div>

        <div className={styles.list}>
          {isLoading && <CenteredSpinner />}
          {visible.map((workspace) => (
            <button key={workspace.guid} className={styles.workspace} onClick={() => open(workspace.path)}>
              <span className={styles.workspaceIcon}>{workspace.name.charAt(0).toUpperCase()}</span>
              <span className={styles.workspaceText}>
                <span className={styles.workspaceName}>{workspace.name}</span>
                <span className={styles.workspacePath}>{workspace.path}</span>
              </span>
              {recentWorkspacePaths.includes(workspace.path) && <span className={styles.recent}>Recent</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function useOpenWorkspace(): (path: string) => void {
  const openWorkspace = useSession((state) => state.openWorkspace);
  return (path) => {
    openWorkspace(path);
    void rememberRecentWorkspace(path);
  };
}

function sortByRecent(workspaces: WorkspaceSummary[], recentPaths: string[]): WorkspaceSummary[] {
  const rank = (workspace: WorkspaceSummary): number => {
    const index = recentPaths.indexOf(workspace.path);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return [...workspaces].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
