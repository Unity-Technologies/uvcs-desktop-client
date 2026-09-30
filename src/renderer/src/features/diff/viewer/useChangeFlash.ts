import { useEffect, useRef, useState } from 'react';
import type { ChangedLine } from './changeBlocks';
import { changeFlashCss } from './lineMarksCss';

/** How long a change moved to stays lit. */
const FLASH_MS = 1200;

/** The change moved to, lit for a moment: `css` for the diff's shadow root (`changeFlashCss`), `light` to light one. */
export function useChangeFlash(): { css: string; light: (lines: ChangedLine[]) => void } {
  const [flash, setFlash] = useState<{ lines: ChangedLine[]; round: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return {
    css: flash ? changeFlashCss(flash.lines, flash.round) : '',
    light: (lines) => {
      setFlash((last) => ({ lines, round: (last?.round ?? 0) + 1 }));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash((last) => last && { ...last, lines: [] }), FLASH_MS);
    },
  };
}
