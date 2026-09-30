import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavItem, useInRail } from '../../ui/nav/SidebarNav';
import { SIDEBAR_SHORTCUT, toggleSidebar } from './sidebarStore';

/** The sidebar's own fold/unfold entry, at its foot. */
export function SidebarToggleItem() {
  const rail = useInRail();
  return (
    <NavItem
      icon={rail ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
      label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
      railLabel="Expand"
      shortcut={SIDEBAR_SHORTCUT}
      onClick={toggleSidebar}
    />
  );
}
