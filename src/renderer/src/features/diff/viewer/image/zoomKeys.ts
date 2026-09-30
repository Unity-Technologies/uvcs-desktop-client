/** What a key pressed on the focused image stage does to the view. */
export type ZoomCommand = 'zoomIn' | 'zoomOut' | 'zoomToFit' | 'zoomToActualSize';

/** The image stage's keys: + (or =) and − step the zoom, 0 fits the image, 1 shows it at 100%. */
export function zoomCommandOf(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>): ZoomCommand | null {
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
