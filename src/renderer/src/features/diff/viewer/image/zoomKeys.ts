/** What a key pressed on the focused image stage does to the view. */
export type ZoomCommand = 'zoomIn' | 'zoomOut' | 'zoomToFit' | 'zoomToActualSize';

/**
 * The image stage's keys: + (or =) and − step the zoom, 0 fits the image, 1 shows it at 100%. Held with ⌘, Ctrl or Alt
 * they're the window's (⌘1 goes to the first view), not the image's.
 */
export function zoomCommandOf(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>): ZoomCommand | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  switch (event.key) {
    case '+':
    case '=':
      return 'zoomIn';
    case '-':
      return 'zoomOut';
    case '0':
      return 'zoomToFit';
    case '1':
      return 'zoomToActualSize';
    default:
      return null;
  }
}
