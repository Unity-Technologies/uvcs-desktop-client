const FOCUSED_MS = 60_000;
const BEHIND_OTHER_APPS_MS = 5 * 60_000;

/** How often to check the server for incoming changesets: never while nobody can see the window. */
export function incomingPollInterval(visible: boolean, focused: boolean): number | false {
  if (!visible) return false;
  return focused ? FOCUSED_MS : BEHIND_OTHER_APPS_MS;
}
