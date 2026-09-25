import { ChevronsUpDown, Settings } from 'lucide-react';
import { useNavigation } from '../navigation/navigationStore';
import { VIEWS, type ViewDefinition } from '../navigation/viewRegistry';
import { useWorkspaceInfo } from '../workspace/useWorkspace';
import { useSession } from '../workspace/sessionStore';
import { openSettingsDialog } from '../settings/SettingsDialog';
import { Tooltip } from '../../ui/Tooltip';
import styles from './Sidebar.module.css';

const GROUPS: ViewDefinition['group'][] = ['Workspace', 'History', 'Collaborate'];

export function Sidebar() {
  const { data: workspace } = useWorkspaceInfo();
  const closeWorkspace = useSession((state) => state.closeWorkspace);

  return (
    <nav className={styles.sidebar}>
      <div className={styles.dragRegion} />
      <Tooltip content="Switch workspace" side="right">
        <button className={styles.workspace} onClick={closeWorkspace}>
          <span className={styles.workspaceIcon}>{workspace?.name.charAt(0).toUpperCase()}</span>
          <span className={styles.workspaceText}>
            <span className={styles.workspaceName}>{workspace?.name ?? '…'}</span>
            <span className={styles.workspaceRepo}>{workspace?.repository}</span>
          </span>
          <ChevronsUpDown size={14} className={styles.workspaceChevron} />
        </button>
      </Tooltip>

      <div className={styles.groups}>
        {GROUPS.map((group) => (
          <div key={group} className={styles.group}>
            <div className={styles.groupLabel}>{group}</div>
            {VIEWS.filter((view) => view.group === group).map((view) => (
              <SidebarItem key={view.id} view={view} />
            ))}
          </div>
        ))}
      </div>

      <button className={styles.item} onClick={openSettingsDialog}>
        <Settings size={15} className={styles.itemIcon} />
        <span className={styles.itemLabel}>Settings</span>
      </button>
    </nav>
  );
}

function SidebarItem({ view }: { view: ViewDefinition }) {
  const { view: activeView, pages, goToView } = useNavigation();
  const badge = view.useBadge?.();
  const Icon = view.icon;
  const active = activeView === view.id;

  return (
    <button
      className={styles.item}
      data-active={active}
      data-dimmed={active && pages.length > 0}
      onClick={() => goToView(view.id)}
    >
      <Icon size={15} className={styles.itemIcon} />
      <span className={styles.itemLabel}>{view.label}</span>
      {badge ? <span className={styles.badge}>{badge > 999 ? '999+' : badge}</span> : null}
    </button>
  );
}
