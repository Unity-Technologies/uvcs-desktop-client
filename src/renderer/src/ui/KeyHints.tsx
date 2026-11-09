import { useLayoutEffect, useRef, useState } from 'react';
import { classNames } from '../lib/classNames';
import { hintsThatFit } from '../lib/hintsThatFit';
import { Kbd } from './Kbd';
import styles from './KeyHints.module.css';

/** A hint: its keys (one shortcut, or several, each its caps), or text typed as written (`typed`), and what it does. */
export interface KeyHint {
  keys: string | readonly string[];
  label: string;
  typed?: boolean;
}

interface KeyHintsProps {
  hints: readonly KeyHint[];
  caption?: boolean;
  /** One line, never wrapped: hints that don't fit are dropped from the last (`hintsThatFit`), the most useful first. */
  oneLine?: boolean;
}

/**
 * A quiet line under a keyboard-driven list telling its keys, e.g. "⇥ actions": a footer, its top border apart from the
 * list, or a `caption` right under a field, as a field's help reads.
 */
export function KeyHints({ hints, caption = false, oneLine = false }: KeyHintsProps) {
  const shown = useHintsThatFit(hints.length, oneLine);
  return (
    <div ref={shown.line} className={classNames(styles.hints, caption && styles.caption, oneLine && styles.oneLine)}>
      {hints.map(({ keys, label, typed }, index) => (
        <span key={label} className={styles.hint} hidden={index >= shown.count}>
          {(typeof keys === 'string' ? [keys] : keys).map((key) => (
            <Kbd key={key} keys={key} typed={typed} />
          ))}{' '}
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * How many hints fit the line's width, kept as it resizes. Each hint is measured once, all shown (their text doesn't
 * change); hidden ones then take no room.
 */
function useHintsThatFit(total: number, oneLine: boolean) {
  const line = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(total);
  useLayoutEffect(() => {
    const element = line.current;
    if (!oneLine || !element) return;
    const widths = [...element.children].map((hint) => (hint as HTMLElement).offsetWidth);
    const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
    const fit = (): void => setCount(hintsThatFit(widths, gap, element.clientWidth));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [oneLine, total]);
  return { line, count: oneLine ? count : total };
}
