import { useMemo } from 'react';
import type { Place } from '@shared/domain/place';
import { useCommands, type Command } from '../commands/commandStore';
import { refreshCommand } from '../commands/refreshCommand';
import { viewCommands } from '../commands/viewCommands';
import { navigation } from '../navigation/navigationStore';
import { VIEWS } from '../navigation/viewRegistry';
import { usePlace } from '../workspace/useWorkspace';

export function usePageWindowCommands(): void {
  const place = usePlace();
  useCommands(useMemo(() => pageWindowCommands(place), [place]));
}

/**
 * A page window shows no views: going to one (⌘1…, the palette) brings its workspace window forward on that view
 * (`navigation.goToView` in a page window). The menu bar's workspace commands go there the same way (`useMenuCommands`),
 * but Refresh, which reads the window's own page again (`refreshCommand`).
 */
export function pageWindowCommands(place: Place): Command[] {
  return [...viewCommands(VIEWS, navigation.goToView), refreshCommand(place)];
}
