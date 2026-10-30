import { useEffect, useState, type RefObject } from 'react';
import { pictureEnlarges } from './inlinePictureView';

/**
 * Whether a click on a loaded picture enlarges it (`pictureEnlarges`), measured again whenever the width it is shown
 * at changes: a narrower window shrinks a dialog, and a picture shown whole can become one shown smaller.
 */
export function usePictureEnlarges(picture: RefObject<HTMLImageElement | null>, loaded: boolean): boolean {
  const [enlarges, setEnlarges] = useState(false);

  useEffect(() => {
    const element = picture.current;
    if (!loaded || !element) return;
    const measure = (): void => setEnlarges(pictureEnlarges(element.naturalWidth, element.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [picture, loaded]);

  return enlarges;
}
