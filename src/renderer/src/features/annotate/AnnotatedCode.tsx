import { Virtualizer } from '@pierre/diffs';
import { File, VirtualizerContext, WorkerPoolContext } from '@pierre/diffs/react';
import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { fileNameOf } from '../../lib/text';
import { AnnotationGutter, type AnnotateBefore } from './AnnotationGutter';
import type { AnnotateColumns } from './annotateOptionsStore';
import type { AnnotationRow } from './annotationRows';
import { useResolvedTheme } from '../../app/settings/useResolvedTheme';
import { highlightWorkers } from '../diff/viewer/highlightWorkers';
import { PIERRE_SURFACE_CSS, pierreThemeName } from '../diff/viewer/pierreOptions';
import { highlightedLanguage, syntaxHighlighting } from '../diff/viewer/syntaxHighlighting';
import { useVisibleRows } from './useVisibleRows';
import styles from './AnnotatedCode.module.css';

/**
 * Pierre's line height and top padding, pinned so the gutter can lay out its rows with the same geometry.
 * The gutter reads the padding from the shared `--diffs-gap-block` variable.
 */
const ANNOTATION_LINE_HEIGHT = 20;
const CODE_PADDING_TOP = 8;

// Seed Pierre's surface from the app's own background so the editor blends into the page.

interface AnnotatedCodeProps {
  code: string;
  path: string;
  rows: AnnotationRow[];
  columns: AnnotateColumns;
  onOpenChangeset: (changesetId: number) => void;
  annotateBefore?: AnnotateBefore;
}

/**
 * Highlighted code (Pierre) with the annotation gutter beside it. Both live in one scroll container
 * and share a pinned line height, so they scroll together without any syncing code.
 * Files can be huge: both render only the lines in view, and the code is highlighted as a read-only diff would be
 * (`syntaxHighlighting`: on the main thread, in Pierre's workers after showing as plain text, or not at all).
 */
export function AnnotatedCode({ code, path, rows, columns, onOpenChangeset, annotateBefore }: AnnotatedCodeProps) {
  const theme = useResolvedTheme();
  const [virtualizer] = useState(() => new Virtualizer());
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const attachScroller = useCallback(
    (element: HTMLDivElement | null) => {
      if (element) virtualizer.setup(element);
      else virtualizer.cleanUp();
      setScroller(element);
    },
    [virtualizer],
  );
  const range = useVisibleRows(scroller, rows.length, ANNOTATION_LINE_HEIGHT, CODE_PADDING_TOP);

  const highlighting = syntaxHighlighting(code, '', false);
  const workers = highlighting === 'background' ? highlightWorkers() : undefined;
  const file = useMemo(() => ({ name: fileNameOf(path), lang: highlightedLanguage(highlighting, path), contents: code }), [path, code, highlighting]);
  const options = useMemo(
    () => ({
      theme: pierreThemeName(theme),
      themeType: theme,
      overflow: 'scroll' as const,
      disableFileHeader: true,
      unsafeCSS: PIERRE_SURFACE_CSS,
      tokenizeMaxLength: highlighting === 'off' ? 0 : undefined,
    }),
    [theme, highlighting],
  );

  return (
    <div
      ref={attachScroller}
      className={styles.scroller}
      style={{ '--diffs-line-height': `${ANNOTATION_LINE_HEIGHT}px`, '--diffs-gap-block': `${CODE_PADDING_TOP}px` } as CSSProperties}
    >
      <div className={styles.columns}>
        <AnnotationGutter
          rows={rows}
          columns={columns}
          lineHeight={ANNOTATION_LINE_HEIGHT}
          range={range}
          onOpenChangeset={onOpenChangeset}
          annotateBefore={annotateBefore}
        />
        <VirtualizerContext.Provider value={virtualizer}>
          <WorkerPoolContext.Provider value={workers}>
            <File key={theme} className={styles.code} file={file} options={options} disableWorkerPool={!workers} />
          </WorkerPoolContext.Provider>
        </VirtualizerContext.Provider>
      </div>
    </div>
  );
}
