import { Menu } from 'lucide-react';
import { WINDOW_CHROME } from '../../lib/platform';
import { hotkeys } from '../../lib/shortcutRegistry';
import { IconButton } from '../../ui/IconButton';
import { APP_MENU_BUTTON, showAppMenu } from './appMenu';

/** The menus of a window without a menu bar (Windows), where macOS has its traffic lights. */
export function AppMenuButton() {
  if (WINDOW_CHROME !== 'overlay') return null;
  return <IconButton icon={<Menu size={16} />} label="Menu" shortcut={hotkeys('appMenu')[0]} onClick={showAppMenu} {...{ [APP_MENU_BUTTON]: '' }} />;
}
