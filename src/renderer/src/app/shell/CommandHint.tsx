import type { CommandLogEntry } from '@shared/events';
import { useLayoutEffect, useRef, useState } from 'react';
import { textMeasurer } from '../../lib/measureText';
import { trimMiddleToFit } from '../../lib/trimToFit';
import styles from './StatusBar.module.css';

/**
 * The last command in a line, as wide as it is and giving way from its middle when the bar is narrow, so both the
 * command and what it ran on stay readable; its duration after it.
 */
export function CommandHint({ entry }: { entry: CommandLogEntry }) {
  const ref = useRef<HTMLSpanElement>(null);
  const text = entry.commandLine;
  const [fit, setFit] = useState<{ shown: string; width?: number }>({ shown: text });
  // The font stays; reading it again for every command would restyle the page each time.
  const measureRef = useRef<(text: string) => number>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = (measureRef.current ??= textMeasurer(element));
    // Widths are rounded; the extra pixel keeps a rounded-up width from clipping the fitted text.
    const width = Math.ceil(measure(text)) + 1;
    const update = (): void => setFit({ shown: trimMiddleToFit(text, element.clientWidth - 1, measure), width });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return (
    <span className={styles.hint}>
      <span ref={ref} className={styles.commandLine} style={{ width: fit.width }}>
        {fit.shown}
      </span>
      <span className={styles.duration}>{entry.durationMs} ms</span>
    </span>
  );
}
