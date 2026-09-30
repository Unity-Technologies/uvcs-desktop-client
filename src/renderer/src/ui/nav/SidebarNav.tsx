import { createContext, useContext, type ReactNode } from 'react';
import { navBadgeText } from './navBadgeText';
import { navItemTip } from './navItemTip';
import styles from './SidebarNav.module.css';

/**
 * Wide enough for the longest one-word labels on one line in every OS's UI font (its tiles leave them 66px:
 * "Changesets" takes 62px in San Francisco, 59px in Arial-wide fonts such as Segoe UI, 64px in Verdana-wide ones such as
 * DejaVu Sans), and for the macOS window buttons, which
 * sit over the rail's top.
 */
const RAIL_WIDTH = 80;

const RailContext = createContext(false);

/** Whether the sidebar around shows as its rail: each item a tile, its icon over its label in small type. */
export function useInRail(): boolean {
  return useContext(RailContext);
}

interface SidebarProps {
  children: ReactNode;
  width?: number;
  /** Folded into a narrow rail of tiles. */
  rail?: boolean;
  /** Its title-bar area continues the window's top bar (same sheen and bottom edge) instead of the sidebar's colour. */
  joinsTopBar?: boolean;
  /** Shown at the start of its title-bar area, where macOS has its traffic lights (the window's menu button). */
  titleBarStart?: ReactNode;
}

/** The column that holds an app sidebar: a draggable title-bar area, then the content. */
export function Sidebar({ children, width = 216, rail = false, joinsTopBar = false, titleBarStart }: SidebarProps) {
  return (
    <nav className={styles.sidebar} data-rail={rail} style={{ width: rail ? RAIL_WIDTH : width }}>
      <div className={styles.dragRegion} data-joins-top-bar={joinsTopBar}>
        {titleBarStart}
      </div>
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
  /** Its name, shown and read as it; the tooltip and screen readers keep it whole when the rail shortens it. */
  label: string;
  /** Shown instead of the label on the rail's tile, where room is short ("Expand" for "Expand sidebar"). */
  railLabel?: string;
  /** Quiet text at the right, e.g. "Cloud". */
  detail?: string;
  /** A count at the right, e.g. pending changes. */
  badge?: number;
  /**
   * A dot at the right, saying what waits there ("Changes left on /main/task · restore them in Changes"): the words
   * show under the item's tooltip and are read with it.
   */
  dot?: string;
  active?: boolean;
  /** Active, but a page is open on top of it. */
  dimmed?: boolean;
  /** Shown with its label as a tooltip. */
  shortcut?: string;
  onClick: () => void;
}

export function NavItem(props: NavItemProps) {
  const { icon, label, railLabel, detail, badge, dot, active = false, dimmed = false, shortcut, onClick } = props;
  const rail = useInRail();
  const tip = navItemTip({ label, railLabel, detail, badge, dot, shortcut }, rail);
  const shownLabel = rail && railLabel ? railLabel : label;

  return (
    <button
      type="button"
      className={styles.item}
      data-active={active}
      data-dimmed={dimmed}
      aria-current={active ? 'page' : undefined}
      data-tip={tip}
      data-tip-sub={dot}
      data-tip-shortcut={shortcut}
      aria-label={shownLabel === label ? undefined : label}
      aria-description={dot}
      onClick={onClick}
    >
      <span className={styles.icon}>{icon}</span>
      <span className={styles.label}>{shownLabel}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
      {/* At the row's end wide; on the rail's tile, side by side at its icon's top-right corner. */}
      <span className={styles.marks}>
        {dot && <span className={styles.dot} />}
        {badge ? <span className={styles.badge}>{navBadgeText(badge, rail)}</span> : null}
      </span>
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
