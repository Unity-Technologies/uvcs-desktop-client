import { File } from '@pierre/diffs/react';
import { useMemo, type CSSProperties } from 'react';
import { fileNameOf } from '../../lib/text';
import { AnnotationGutter } from './AnnotationGutter';
import type { AnnotateColumns } from './annotateOptionsStore';
import type { AnnotationRow } from './annotationRows';
import { useDocumentTheme } from './useDocumentTheme';
import styles from './AnnotatedCode.module.css';

/**
 * Pierre's line height and top padding, pinned so the gutter can lay out its rows with the same geometry.
 * The gutter reads the padding from the shared `--diffs-gap-block` variable.
 */
const ANNOTATION_LINE_HEIGHT = 20;
const CODE_PADDING_TOP = 8;

// Seed Pierre's surface from the app's own background so the editor blends into the page.
const PIERRE_SURFACE_CSS = ':host{--diffs-bg:var(--bg-surface);background-color:var(--bg-surface)}';

interface AnnotatedCodeProps {
  code: string;
  path: string;
  rows: AnnotationRow[];
  columns: AnnotateColumns;
  onOpenChangeset: (changesetId: number) => void;
}

/**
 * Highlighted code (Pierre) with the annotation gutter beside it. Both live in one scroll container
 * and share a pinned line height, so they scroll together without any syncing code.
 */
export function AnnotatedCode({ code, path, rows, columns, onOpenChangeset }: AnnotatedCodeProps) {
  const theme = useDocumentTheme();
  const file = useMemo(() => ({ name: fileNameOf(path), contents: code }), [path, code]);
  const options = useMemo(
    () => ({
      theme: theme === 'dark' ? ('pierre-dark' as const) : ('pierre-light' as const),
      themeType: theme,
      overflow: 'scroll' as const,
      disableFileHeader: true,
      unsafeCSS: PIERRE_SURFACE_CSS,
    }),
    [theme],
  );

  return (
    <div
      className={styles.scroller}
      style={{ '--diffs-line-height': `${ANNOTATION_LINE_HEIGHT}px`, '--diffs-gap-block': `${CODE_PADDING_TOP}px` } as CSSProperties}
    >
      <div className={styles.columns}>
        <AnnotationGutter rows={rows} columns={columns} lineHeight={ANNOTATION_LINE_HEIGHT} onOpenChangeset={onOpenChangeset} />
        <File key={theme} className={styles.code} file={file} options={options} disableWorkerPool />
      </div>
    </div>
  );
}
