import type { Virtualizer } from '@pierre/diffs';
import { File, VirtualizerContext, WorkerPoolContext } from '@pierre/diffs/react';
import { useMemo } from 'react';
import { useResolvedTheme } from '../../app/settings/useResolvedTheme';
import { fileNameOf } from '../../lib/text';
import { useHighlightWorkers } from '../diff/viewer/highlightWorkers';
import { PIERRE_SURFACE_CSS, pierreThemeName } from '../diff/viewer/pierreOptions';
import { highlightedLanguage, syntaxHighlighting } from '../diff/viewer/syntaxHighlighting';

interface HighlightedCodeProps {
  className: string;
  code: string;
  path: string;
  /** The annotation's, set up on its scrolling element: the code renders only the lines in view. */
  virtualizer: Virtualizer;
}

/** The file's code, highlighted by size as a read-only diff is, rendering only the lines in view. */
export function HighlightedCode({ className, code, path, virtualizer }: HighlightedCodeProps) {
  const theme = useResolvedTheme();
  const highlighting = syntaxHighlighting(code, '', false);
  const workers = useHighlightWorkers(highlighting === 'background');
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
    <VirtualizerContext.Provider value={virtualizer}>
      <WorkerPoolContext.Provider value={workers}>
        <File key={theme} className={className} file={file} options={options} disableWorkerPool={!workers} />
      </WorkerPoolContext.Provider>
    </VirtualizerContext.Provider>
  );
}
