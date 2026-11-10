import { RefreshCw } from 'lucide-react';
import type { Place } from '@shared/domain/place';
import { hotkey } from '../../lib/shortcutRegistry';
import { refreshShown } from '../refresh/refreshShown';
import type { Command } from './commandStore';

/**
 * Refresh (⌘R, the menu's): what the window shows, or only the page in front's when it says (`refreshShown`). A page
 * window has it too, so ⌘R there reads its page again rather than bringing the workspace window forward.
 */
export function refreshCommand(place: Place): Command {
  return {
    id: 'workspace.refresh',
    group: 'Workspace',
    label: 'Refresh',
    icon: RefreshCw,
    shortcut: hotkey('refresh'),
    run: () => void refreshShown(place),
  };
}
