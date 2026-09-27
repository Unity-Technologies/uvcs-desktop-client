import { useLayoutEffect, useRef, useState } from 'react';
import { textMeasurer } from '../lib/measureText';
import { ELLIPSIS, folderRoom, positionsInTrimmed, trimFolderToFit } from '../lib/trimToFit';
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
  /**
   * As wide as the whole path (up to its container) and no narrower than the name, where the container wraps the
   * label rather than sizing it.
   */
  fitContent?: boolean;
  /** False where the element around it has a tooltip naming the path already. */
  tooltip?: boolean;
}

/**
 * `src/app/main.ts` rendered as a dimmed folder followed by the file name; branches read the same way, the parent
 * branches dimmed before the leaf. When it doesn't fit, whole folders are dropped from the middle
 * (`src/…/app/main.ts`) so the name always stays whole. The cut is measured rather than left to CSS `text-overflow`,
 * which would cut the name first.
 */
export function PathLabel({ path, nameOnly, oldPath, strikethrough, matches, fitContent, tooltip = true }: PathLabelProps) {
  const nameStart = path.lastIndexOf('/') + 1;
  const name = path.slice(nameStart);
  const directory = nameOnly ? '' : path.slice(0, nameStart);
  const ref = useRef<HTMLSpanElement>(null);
  const [shownDirectory, setShownDirectory] = useState(directory);
  const [contentSize, setContentSize] = useState<{ width: number; minWidth: string; flexShrink: number }>();

  // Fit before paint, so recycled rows of a virtual list don't flash, and again whenever the container resizes.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fit = (): void => {
      const measure = textMeasurer(element);
      // Widths are rounded; the extra pixel keeps a rounded-up width from clipping the fitted text.
      if (fitContent) {
        const nameWidth = Math.ceil(measure(name)) + 1;
        // Next to other labels, the one with the most folder to drop gives way first.
        setContentSize({ width: Math.ceil(measure(directory)) + nameWidth, minWidth: `min(${nameWidth}px, 100%)`, flexShrink: measure(directory) });
      }
      setShownDirectory(directory && trimFolderToFit(directory, folderRoom(element.clientWidth, measure(name) + 1, measure), measure));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [directory, name, fitContent]);

  const trimmed = shownDirectory !== directory;

  return (
    <span
      ref={ref}
      className={styles.path}
      data-fit-content={fitContent}
      style={fitContent ? contentSize : undefined}
      data-tip={!tooltip ? undefined : oldPath ? `${oldPath} → ${path}` : trimmed ? path : undefined}
    >
      {shownDirectory && (
        // Only `…/` left: it stays, and the name gives way.
        <span className={styles.directory} data-min={shownDirectory === `${ELLIPSIS}/` || undefined}>
          <Highlight text={shownDirectory} positions={matches && positionsInTrimmed(directory, shownDirectory, matches.filter((position) => position < nameStart))} />
        </span>
      )}
      <span className={styles.name} data-strikethrough={strikethrough}>
        <Highlight text={name} positions={matches?.filter((position) => position >= nameStart).map((position) => position - nameStart)} />
      </span>
    </span>
  );
}
