import { House } from 'lucide-react';
import { hotkey } from '../../lib/shortcutRegistry';
import { IconButton } from '../../ui/IconButton';
import styles from './HomeButton.module.css';

interface HomeButtonProps {
  /** The window shows the home screen: the house is lit, and a click goes back to its first section. */
  atHome: boolean;
  onClick: () => void;
}

/**
 * The way home, at the start of the top bar on every screen: one place whether the sidebar is folded or not, and
 * the root of what follows it (the workspace's branch). The app's mark and name live on the home screen's welcome.
 */
export function HomeButton({ atHome, onClick }: HomeButtonProps) {
  return (
    <IconButton
      icon={<House size={16} />}
      label="Home"
      shortcut={hotkey('home')}
      className={styles.home}
      aria-current={atHome ? 'page' : undefined}
      onClick={onClick}
    />
  );
}
