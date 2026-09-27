import { createContext, useContext, type ReactNode } from 'react';
import { isMac } from '../../lib/platform';
import styles from './SidebarNav.module.css';

/** Wide enough for the macOS window buttons, which sit over the rail's top. */
const RAIL_WIDTH = isMac ? 76 : 56;

const RailContext = createContext(false);

/** Whether the sidebar around shows as its icon rail: items show their icon only, with their label as a tooltip. */
export function useInRail(): boolean {
  return useContext(RailContext);
}

interface SidebarProps {
  children: ReactNode;
  width?: number;
  /** Folded into a rail of icons. */
  rail?: boolean;
  /** Its title-bar area continues the window's top bar (same sheen and bottom edge) instead of the sidebar's colour. */
  joinsTopBar?: boolean;
}

/** The column that holds an app sidebar: a draggable title-bar area, then the content. */
export function Sidebar({ children, width = 216, rail = false, joinsTopBar = false }: SidebarProps) {
  return (
    <nav className={styles.sidebar} data-rail={rail} style={{ width: rail ? RAIL_WIDTH : width }}>
      <div className={styles.dragRegion} data-joins-top-bar={joinsTopBar} data-drag-region />
      <RailContext.Provider value={rail}>{children}</RailContext.Provider>
    </nav>
  );
}

export function NavGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      {label && <div className={styles.groupLabel}>{label}</div>}
      {children}
    </div>
  );
}

interface NavItemProps {
  icon: ReactNode;
  label: string;
  /** Quiet text at the right, e.g. "Cloud". */
  detail?: string;
  /** A count at the right, e.g. pending changes. */
  badge?: number;
  /** A dot at the right: something waits there. */
  dot?: boolean;
  active?: boolean;
  /** Active, but a page is open on top of it. */
  dimmed?: boolean;
  /** Shown with its label as a tooltip (in the rail, the label shows there too). */
  shortcut?: string;
  onClick: () => void;
}

export function NavItem({ icon, label, detail, badge, dot = false, active = false, dimmed = false, shortcut, onClick }: NavItemProps) {
  const rail = useInRail();
  // Wide, the label shows already: the tooltip is there to tell the shortcut.
  const tip = rail ? [label, detail, badge ? `${badge}` : undefined].filter(Boolean).join(' · ') : shortcut && label;

  return (
    <button
      type="button"
      className={styles.item}
      data-active={active}
      data-dimmed={dimmed}
      aria-current={active ? 'page' : undefined}
      data-tip={tip}
      data-tip-shortcut={shortcut}
      aria-label={rail ? label : undefined}
      onClick={onClick}
    >
      <span className={styles.icon}>{icon}</span>
      <span className={styles.label}>{label}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
      {dot && <span className={styles.dot} />}
      {badge ? <span className={styles.badge}>{badge > 999 ? '999+' : badge}</span> : null}
    </button>
  );
}

/** Pushes what follows to the bottom of the sidebar. */
export function NavFooter({ children }: { children: ReactNode }) {
  return <div className={styles.footer}>{children}</div>;
}

/** Scrollable middle section holding the groups. */
export function NavGroups({ children }: { children: ReactNode }) {
  return <div className={styles.groups}>{children}</div>;
}
