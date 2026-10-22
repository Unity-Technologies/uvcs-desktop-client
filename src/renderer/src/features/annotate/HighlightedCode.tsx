import type { SelectedLineRange, Virtualizer } from '@pierre/diffs';
import { File, VirtualizerContext, WorkerPoolContext, type FileOptions } from '@pierre/diffs/react';
import { useMemo } from 'react';
import { useResolvedTheme } from '../../app/settings/useResolvedTheme';
import { fileNameOf } from '../../lib/text';
import { useHighlightWorkers } from '../diff/viewer/highlightWorkers';
import { withLongLinesCut } from '../diff/viewer/longLines';
import { PIERRE_SURFACE_CSS, pierreThemeName } from '../diff/viewer/pierreOptions';
import { highlightedLanguage, syntaxHighlighting } from '../diff/viewer/syntaxHighlighting';

interface HighlightedCodeProps {
  className: string;
  code: string;
  path: string;
  /** The annotation's, set up on its scrolling element: the code renders only the lines in view. */
  virtualizer: Virtualizer;
  /** Selecting lines by their numbers (`useLineLinks`), and the lines selected. */
  selectionOptions: Pick<FileOptions<undefined, undefined>, 'enableLineSelection' | 'lineHoverHighlight' | 'onLineSelectionChange' | 'onLineSelected'>;
  selectedLines: SelectedLineRange | null | undefined;
}

/** The file's code, highlighted by size as a read-only diff is, rendering only the lines in view; a line too long to draw is cut. */
export function HighlightedCode({ className, code, path, virtualizer, selectionOptions, selectedLines }: HighlightedCodeProps) {
  const theme = useResolvedTheme();
  const highlighting = syntaxHighlighting(code, '', false);
  const workers = useHighlightWorkers(highlighting === 'background');
  // Each row is one line high, beside its annotation, so a line too long to draw can't wrap: it's cut instead.
  const file = useMemo(() => ({ name: fileNameOf(path), lang: highlightedLanguage(highlighting, path), contents: withLongLinesCut(code) }), [path, code, highlighting]);
  const options = useMemo(
    () => ({
      theme: pierreThemeName(theme),
      themeType: theme,
      overflow: 'scroll' as const,
      disableFileHeader: true,
      unsafeCSS: PIERRE_SURFACE_CSS,
      tokenizeMaxLength: highlighting === 'off' ? 0 : undefined,
      ...selectionOptions,
    }),
    [theme, highlighting, selectionOptions],
  );
  return (
    <VirtualizerContext.Provider value={virtualizer}>
      <WorkerPoolContext.Provider value={workers}>
        <File key={theme} className={className} file={file} options={options} selectedLines={selectedLines} disableWorkerPool={!workers} />
      </WorkerPoolContext.Provider>
    </VirtualizerContext.Provider>
  );
}
