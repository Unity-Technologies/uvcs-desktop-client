import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppMenuButton } from './AppMenuButton';
import { HomeButton } from './HomeButton';
import styles from './TopBar.module.css';

interface TopBarProps {
  /**
   * Goes to the home screen, or back to its first section when already there. None in a page window, which shows one
   * page of its workspace window's.
   */
  onHome?: () => void;
  /** The screen is the home screen. */
  atHome?: boolean;
  /** The place the screen shows (a workspace, or a repository explored without one), after the home button. */
  place?: ReactNode;
  /** What the screen shows after the place (a workspace's branch), a `›` between them. */
  children?: ReactNode;
  /** What the screen shows at the end (a workspace's search and account). */
  end?: ReactNode;
}

/**
 * The window's top bar, across the window on every screen, the sidebar under it: the window's buttons (macOS' traffic
 * lights inset over its start, Windows' menu button, `windowChrome`), the home button, then what the screen adds: a
 * place reads as a breadcrumb, home › workspace › branch, outer to inner, as a workspace holds a branch.
 * Nothing stands between the house and the first pill: a separator there left the borderless house floating between
 * three edges, its spacing unreadable; alone, its box and its icon sit evenly between the window's buttons and the pill.
 */
export function TopBar({ onHome, atHome = false, place, children, end }: TopBarProps) {
  return (
    <header className={styles.topBar}>
      <AppMenuButton />
      {onHome && <HomeButton atHome={atHome} onClick={onHome} />}
      {place}
      {place && children && <ChevronRight size={14} className={styles.step} aria-hidden />}
      {children}
      <div className={styles.spacer} />
      {end}
    </header>
  );
}
