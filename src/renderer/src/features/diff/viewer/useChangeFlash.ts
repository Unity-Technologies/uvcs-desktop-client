import { useEffect, useRef, useState } from 'react';
import { flashCss } from './lineMarksCss';

/** How long a change moved to stays lit. */
const FLASH_MS = 1200;

/**
 * The change (or conflict) moved to, lit for a moment: `css` for the view's shadow root (`flashCss`), `light` to light
 * its rows (a selector: `changeRows` for a diff's change).
 */
export function useChangeFlash(): { css: string; light: (rows: string) => void } {
  const [flash, setFlash] = useState<{ rows: string; round: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return {
    css: flash ? flashCss(flash.rows, flash.round) : '',
    light: (rows) => {
      setFlash((last) => ({ rows, round: (last?.round ?? 0) + 1 }));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash((last) => last && { ...last, rows: '' }), FLASH_MS);
    },
  };
}
