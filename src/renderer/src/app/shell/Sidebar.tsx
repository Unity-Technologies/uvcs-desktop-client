import { Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavFooter, NavGroups, NavItem, Sidebar as SidebarColumn, type NavSection } from '../../ui/nav/SidebarNav';
import { useNavigation } from '../navigation/navigationStore';
import { sidebarGroups } from '../navigation/sidebarGroups';
import { viewsOf, type ViewDefinition } from '../navigation/viewRegistry';
import { openSettingsDialog } from '../settings/SettingsDialog';
import { usePlace } from '../workspace/useWorkspace';
import { useSidebarCollapsed } from './sidebarStore';
import { SidebarToggleItem } from './SidebarToggleItem';

/** The sidebar: the place's card (`card`), its views by group (`viewsOf`), then Settings and the rail toggle. */
export function Sidebar({ card }: { card: ReactNode }) {
  const views = viewsOf(usePlace());
  const rail = useSidebarCollapsed();
  const activeView = useNavigation((state) => state.view);
  const sections: NavSection[] = sidebarGroups(views).map(({ group, views: inGroup }) => ({
    label: group,
    items: inGroup.map((view) => ({ key: view.id, element: <SidebarViewItem view={view} />, active: view.id === activeView })),
  }));

  return (
    <SidebarColumn rail={rail}>
      {card}

      <NavGroups sections={sections} />

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
