import { useMemo } from 'react';
import { useCommands } from '../commands/commandStore';
import { viewCommands } from '../commands/viewCommands';
import { navigation } from '../navigation/navigationStore';
import { VIEWS } from '../navigation/viewRegistry';

/**
 * A page window shows no views: going to one (⌘1…, the palette) brings its workspace window forward on that view
 * (`navigation.goToView` in a page window). The menu bar's workspace commands go there the same way (`useMenuCommands`).
 */
export function usePageWindowCommands(): void {
  useCommands(useMemo(() => viewCommands(VIEWS, navigation.goToView), []));
}
