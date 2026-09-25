import type { ReactNode } from 'react';
import styles from './SidebarNav.module.css';

/** The column that holds an app sidebar: a draggable title-bar area, then the content. */
export function Sidebar({ children, width = 216 }: { children: ReactNode; width?: number }) {
  return (
    <nav className={styles.sidebar} style={{ width }}>
      <div className={styles.dragRegion} />
      {children}
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
  /** Shown in its tooltip. */
  shortcut?: string;
  onClick: () => void;
}

export function NavItem({ icon, label, detail, badge, dot = false, active = false, dimmed = false, shortcut, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      className={styles.item}
      data-active={active}
      data-dimmed={dimmed}
      aria-current={active ? 'page' : undefined}
      data-tip={shortcut && label}
      data-tip-shortcut={shortcut}
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
