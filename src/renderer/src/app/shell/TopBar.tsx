import type { ReactNode } from 'react';
import { AppBrand } from './AppBrand';
import { AppMenuButton } from './AppMenuButton';
import styles from './TopBar.module.css';

interface TopBarProps {
  /** What the screen shows after the brand, past a separator (a workspace's branch). */
  children?: ReactNode;
  /** What the screen shows at the end (a workspace's search and account). */
  end?: ReactNode;
}

/**
 * The window's top bar, across the window on every screen, the sidebar under it: the window's buttons (macOS' traffic
 * lights inset over its start, Windows' menu button, `windowChrome`), the app's brand, then what the screen adds.
 */
export function TopBar({ children, end }: TopBarProps) {
  return (
    <header className={styles.topBar}>
      <AppMenuButton />
      <AppBrand />
      {children && (
        <>
          <span className={styles.separator} aria-hidden />
          {children}
        </>
      )}
      <div className={styles.spacer} />
      {end}
    </header>
  );
}
