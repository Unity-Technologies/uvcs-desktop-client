import { useEffect, useRef, useState } from 'react';

/**
 * What a page opened on (a link's lines) while it shows the place it opened on (`place`: the revision selected, the
 * item): moving elsewhere drops it for good, so coming back leaves the place as the user left it. The first place known
 * counts: it may be read after the page opens.
 */
export function useFocusUntilMoved<T>(initial: T | null, place: string | undefined): T | null {
  const [focus, setFocus] = useState(initial);
  const first = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (place === undefined || focus === null) return;
    if (first.current === undefined) first.current = place;
    else if (place !== first.current) setFocus(null);
  }, [place, focus]);
  return focus;
}
