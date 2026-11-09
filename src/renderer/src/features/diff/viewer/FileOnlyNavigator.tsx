import { useRef } from 'react';
import { ChangeNavigator } from './ChangeNavigator';
import { useFileOnlyNavigation } from './useFileOnlyNavigation';

/**
 * The change arrows of a diff header with no diff of its own to step through (an xlink's): they go from file to file
 * beside a list (`FileStepsContext`), where a file's diff draws them too. `path` is the item shown, as the list names
 * it: the presses a burst kept for it are replayed as steps from it, and those made while a step from it is in flight
 * wait for the file it went to (`routePress`).
 */
export function FileOnlyNavigator({ path }: { path: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const navigation = useFileOnlyNavigation(frame, { path });
  return <ChangeNavigator ref={frame} navigation={navigation} stepsOwn={false} keysWhileTyping />;
}
