import type { ReactNode } from 'react';
import { AppMenuButton } from './AppMenuButton';
import { HomeButton } from './HomeButton';
import styles from './TopBar.module.css';

interface TopBarProps {
  /** Goes to the home screen, or back to its first section when already there. */
  onHome: () => void;
  /** The screen is the home screen. */
  atHome?: boolean;
  /** What the screen shows after the home button (a workspace's branch). */
  children?: ReactNode;
  /** What the screen shows at the end (a workspace's search and account). */
  end?: ReactNode;
}

/**
 * The window's top bar, across the window on every screen, the sidebar under it: the window's buttons (macOS' traffic
 * lights inset over its start, Windows' menu button, `windowChrome`), the home button, then what the screen adds.
 * Nothing stands between the house and the branch: a separator there left the borderless house floating between
 * three edges, its spacing unreadable; alone, its box and its icon sit evenly between the window's buttons and the pill.
 */
export function TopBar({ onHome, atHome = false, children, end }: TopBarProps) {
  return (
    <header className={styles.topBar}>
      <AppMenuButton />
      <HomeButton atHome={atHome} onClick={onHome} />
      {children}
      <div className={styles.spacer} />
      {end}
    </header>
  );
}
