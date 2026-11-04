import { useRef } from 'react';
import { ChangeNavigator } from './ChangeNavigator';
import { useFileOnlyNavigation } from './useFileOnlyNavigation';

/**
 * The change arrows of a diff header with no diff of its own to step through (an xlink's): they go from file to file
 * beside a list (`FileStepsContext`), where a file's diff draws them too.
 */
export function FileOnlyNavigator() {
  const frame = useRef<HTMLDivElement>(null);
  const navigation = useFileOnlyNavigation(frame);
  return <ChangeNavigator ref={frame} navigation={navigation} stepsOwn={false} keysWhileTyping />;
}
