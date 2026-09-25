import { useLayoutEffect, useRef, useState } from 'react';
import { ELLIPSIS, trimToFit } from '../lib/trimToFit';
import { Highlight } from '../ui/Highlight';
import styles from './PathLabel.module.css';

interface PathLabelProps {
  path: string;
  /** Show only the file name (e.g. inside a folder tree). */
  nameOnly?: boolean;
  /** Previous path of a moved item. */
  oldPath?: string;
  strikethrough?: boolean;
  /** Fuzzy-matched positions in `path` to highlight; otherwise the words of the surrounding `HighlightQuery` are. */
  matches?: readonly number[];
}

/**
 * `src/app/main.ts` rendered as a dimmed folder followed by the file name. When it doesn't fit, the folder is cut
 * in the middle of the path so the name always stays whole. The cut is measured rather than left to CSS
 * `text-overflow`, which leaves a ragged gap before the name.
 */
export function PathLabel({ path, nameOnly, oldPath, strikethrough, matches }: PathLabelProps) {
  const nameStart = path.lastIndexOf('/') + 1;
  const name = path.slice(nameStart);
  const directory = nameOnly ? '' : path.slice(0, nameStart);
  const ref = useRef<HTMLSpanElement>(null);
  const [shownDirectory, setShownDirectory] = useState(directory);

  // Fit before paint, so recycled rows of a virtual list don't flash, and again whenever the container resizes.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !directory) return setShownDirectory(directory);
    const fit = (): void => {
      const measure = textMeasurer(element);
      // clientWidth is rounded; the extra pixel keeps a rounded-up width from clipping the fitted text.
      setShownDirectory(trimToFit(directory, element.clientWidth - measure(name) - 1, measure));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [directory, name]);

  const keptLength = shownDirectory === directory ? directory.length : shownDirectory.length - ELLIPSIS.length;

  return (
    <span ref={ref} className={styles.path} title={oldPath ? `${oldPath} → ${path}` : path}>
      {shownDirectory && (
        <span className={styles.directory}>
          <Highlight text={shownDirectory} positions={matches?.filter((position) => position < keptLength)} />
        </span>
      )}
      <span className={styles.name} data-strikethrough={strikethrough}>
        <Highlight text={name} positions={matches?.filter((position) => position >= nameStart).map((position) => position - nameStart)} />
      </span>
    </span>
  );
}

let canvasContext: CanvasRenderingContext2D | null = null;

function textMeasurer(element: HTMLElement): (text: string) => number {
  canvasContext ??= document.createElement('canvas').getContext('2d');
  const context = canvasContext;
  if (!context) return (text) => text.length * 8;
  const style = getComputedStyle(element);
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  context.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
  return (text) => context.measureText(text).width;
}
