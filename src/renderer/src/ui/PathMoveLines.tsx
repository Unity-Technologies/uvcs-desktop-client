import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fitPathParts } from '../lib/fitPathParts';
import { textMeasurer } from '../lib/measureText';
import { pathChangeSegments, type PathPart } from '../lib/pathChangeSegments';
import type { PathMove } from './followTip';
import styles from './PathMoveLines.module.css';

/** Canvas widths (`textMeasurer`) run a few pixels short of the page's over a long line of parts. */
const MEASURE_SLACK = 4;

interface MoveLine {
  word: 'in' | 'from' | 'to';
  parts: PathPart[];
  /** How its changed parts are marked: what the move removed from the old path, what it added in the new. */
  change?: 'removed' | 'added';
}

/**
 * A move one line a path, what the move changed marked in each (`pathChangeSegments`): the folder both share said once
 * ("in"), then where the item was ("from") and where it is ("to"), removed and added parts in the diff's colors. Each
 * line stays one line: one too wide for the tooltip is cut in its unchanged parts first (`fitPathParts`), so a line
 * never breaks inside what changed.
 */
export function PathMoveLines({ move }: { move: PathMove }) {
  const lines = useMemo(() => moveLines(move), [move.from, move.to]);
  const ref = useRef<HTMLDivElement>(null);
  const [fitted, setFitted] = useState<{ lines: MoveLine[]; fittedLines: PathPart[][] } | null>(null);

  // Each line's cell is as wide as the tooltip lets it be: fit before paint, so a cut line never flashes whole.
  useLayoutEffect(() => {
    const cells = [...(ref.current?.querySelectorAll<HTMLElement>('[data-move-line]') ?? [])];
    if (cells.length !== lines.length) return;
    const measure = textMeasurer(cells[0]!);
    const fit = (line: MoveLine, cell: HTMLElement): PathPart[] =>
      cell.scrollWidth > cell.clientWidth ? fitPathParts(line.parts, cell.clientWidth - MEASURE_SLACK, measure) : line.parts;
    setFitted({ lines, fittedLines: lines.map((line, index) => fit(line, cells[index]!)) });
  }, [lines]);

  const shown = fitted?.lines === lines ? fitted.fittedLines : lines.map((line) => line.parts);
  return (
    <div ref={ref} className={styles.lines}>
      {lines.map((line, index) => (
        <MoveLineRow key={line.word} line={line} parts={shown[index]!} />
      ))}
    </div>
  );
}

function moveLines(move: PathMove): MoveLine[] {
  const change = pathChangeSegments(move.from, move.to);
  const from: MoveLine = { word: 'from', parts: change.old, change: 'removed' };
  const to: MoveLine = { word: 'to', parts: change.new, change: 'added' };
  return change.folder ? [{ word: 'in', parts: [{ text: change.folder, changed: false }] }, from, to] : [from, to];
}

function MoveLineRow({ line, parts }: { line: MoveLine; parts: PathPart[] }) {
  return (
    <>
      <span className={styles.word}>{line.word}</span>
      <span className={styles.path} data-move-line data-shared={line.word === 'in' || undefined}>
        {parts.map((part, index) => (
          <span key={index} className={part.changed ? styles.changed : undefined} data-change={part.changed ? line.change : undefined}>
            {part.text}
          </span>
        ))}
      </span>
    </>
  );
}
