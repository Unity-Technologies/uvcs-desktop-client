import { ChevronsUpDown, Settings } from 'lucide-react';
import { RepositoryAvatar } from '../../components/RepositoryAvatar';
import { NavFooter, NavGroup, NavGroups, NavItem, Sidebar as SidebarColumn } from '../../ui/nav/SidebarNav';
import { useNavigation } from '../navigation/navigationStore';
import { VIEWS, type ViewDefinition } from '../navigation/viewRegistry';
import { openSettingsDialog } from '../settings/SettingsDialog';
import { useWorkspaceInfo, useWorkspacePath } from '../workspace/useWorkspace';
import { useSidebarCollapsed } from './sidebarStore';
import { AppMenuButton } from './AppMenuButton';
import { SidebarToggleItem } from './SidebarToggleItem';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import styles from './Sidebar.module.css';

const GROUPS: ViewDefinition['group'][] = ['Workspace', 'History', 'Collaborate'];

export function Sidebar() {
  const { data: workspace } = useWorkspaceInfo();
  const workspacePath = useWorkspacePath();
  const rail = useSidebarCollapsed();

  return (
    <SidebarColumn rail={rail} joinsTopBar titleBarStart={<AppMenuButton />}>
      <WorkspaceSwitcher currentPath={workspacePath}>
        <button
          className={styles.workspace}
          data-rail={rail}
          aria-label="Switch workspace"
          data-tip={rail ? workspace && `${workspace.name} · ${workspace.repository}` : undefined}
        >
          <RepositoryAvatar repository={workspace?.repository} label={workspace?.name} size={28} />
          <span className={styles.workspaceText}>
            <span className={styles.workspaceName}>{workspace?.name ?? '…'}</span>
            <span className={styles.workspaceRepo}>{workspace?.repository}</span>
          </span>
          <ChevronsUpDown size={14} className={styles.workspaceChevron} />
        </button>
      </WorkspaceSwitcher>

      <NavGroups>
        {GROUPS.map((group) => (
          <NavGroup key={group} label={group}>
            {VIEWS.filter((view) => view.group === group).map((view) => (
              <SidebarViewItem key={view.id} view={view} />
            ))}
          </NavGroup>
        ))}
      </NavGroups>

      <NavFooter>
        <NavItem icon={<Settings size={15} />} label="Settings" onClick={openSettingsDialog} />
        <SidebarToggleItem />
      </NavFooter>
    </SidebarColumn>
  );
}

function SidebarViewItem({ view }: { view: ViewDefinition }) {
  const { view: activeView, pages, goToView } = useNavigation();
  const badge = view.useBadge?.();
  const dot = view.useDot?.();
  const Icon = view.icon;
  const active = activeView === view.id;

  return (
    <NavItem
      icon={<Icon size={15} />}
      label={view.label}
      badge={badge}
      dot={dot}
      active={active}
      dimmed={active && pages.length > 0}
      shortcut={view.shortcut}
      onClick={() => goToView(view.id)}
    />
  );
}
