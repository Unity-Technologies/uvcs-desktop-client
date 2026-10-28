import { Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavFooter, NavGroups, NavItem, Sidebar as SidebarColumn, type NavSection } from '../../ui/nav/SidebarNav';
import { mergeAwaiting, showsMerge } from '../navigation/mergeInProgress';
import { useNavigation } from '../navigation/navigationStore';
import { sidebarGroups } from '../navigation/sidebarGroups';
import type { ViewDefinition } from '../navigation/viewRegistry';
import { openSettingsDialog } from '../settings/SettingsDialog';
import { usePlace } from '../workspace/useWorkspace';
import { useSidebarCollapsed } from './sidebarStore';
import { MergeInProgressItem } from './MergeInProgressItem';
import { SidebarToggleItem } from './SidebarToggleItem';

/**
 * The sidebar: the place's card (`card`), the merge in progress (`MergeInProgress`) while there is one, the place's
 * views by group (`viewsOf`), then Settings and the rail toggle.
 */
export function Sidebar({ card }: { card: ReactNode }) {
  const place = usePlace();
  const rail = useSidebarCollapsed();
  const { view: activeView, pages, merge } = useNavigation();
  const mergeShown = showsMerge(merge, pages);
  const viewSections: NavSection[] = sidebarGroups(place).map(({ label, views: inGroup }) => ({
    label,
    items: inGroup.map((view) => ({ key: view.id, element: <SidebarViewItem view={view} />, active: view.id === activeView })),
  }));
  const awaiting = mergeAwaiting(merge);
  const mergeSection: NavSection[] = awaiting ? [{ items: [{ key: 'merge', element: <MergeInProgressItem merge={awaiting} shown={mergeShown} />, active: mergeShown }] }] : [];
  const sections = [...mergeSection, ...viewSections];

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
