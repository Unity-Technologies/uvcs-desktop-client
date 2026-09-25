import * as Popover from '@radix-ui/react-popover';
import { Layers } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { useSettings } from '../settings/useSettings';
import { useSession } from '../workspace/sessionStore';
import { useOpenWorkspace } from '../workspace/useOpenWorkspace';
import { useWorkspaceList } from '../workspace/workspaceQueries';
import styles from './WorkspaceSwitcher.module.css';

/** Quick switch between recent workspaces without going back to the home screen. */
export function WorkspaceSwitcher({ currentPath, children }: { currentPath: string; children: ReactElement }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const { recentWorkspacePaths } = useSettings();
  const { data: workspaces } = useWorkspaceList();
  const closeWorkspace = useSession((state) => state.closeWorkspace);
  const openWorkspace = useOpenWorkspace();

  const recent = recentWorkspacePaths
    .filter((path) => path !== currentPath)
    .flatMap((path) => workspaces?.find((workspace) => workspace.path === path) ?? [])
    .filter((workspace) => `${workspace.name} ${workspace.path}`.toLowerCase().includes(filter.toLowerCase()));

  const choose = (path: string): void => {
    setOpen(false);
    openWorkspace(path);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.popover} side="bottom" align="start" sideOffset={4}>
          <input
            className={styles.filter}
            placeholder="Switch to workspace…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && recent[0] && choose(recent[0].path)}
            autoFocus
          />
          <div className={styles.list}>
            {recent.length === 0 && <div className={styles.empty}>No other recent workspaces</div>}
            <HighlightQuery query={filter}>
              {recent.map((workspace) => (
                <button key={workspace.guid} className={styles.item} onClick={() => choose(workspace.path)}>
                  <span className={styles.icon}>{workspace.name.charAt(0).toUpperCase()}</span>
                  <span className={styles.text}>
                    <span className={styles.name}>
                      <Highlight text={workspace.name} />
                    </span>
                    <span className={styles.path}>
                      <Highlight text={workspace.path} />
                    </span>
                  </span>
                </button>
              ))}
            </HighlightQuery>
          </div>
          <button className={styles.all} onClick={closeWorkspace}>
            <Layers size={14} />
            All workspaces and repositories…
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
