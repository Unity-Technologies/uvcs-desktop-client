import { File, VirtualizerContext, WorkerPoolContext } from '@pierre/diffs/react';
import { useMemo } from 'react';
import { highlightWorkers } from '../../diff/viewer/highlightWorkers';
import { PaneScrollbars } from '../../diff/viewer/PaneScrollbars';
import { highlightedLanguage, syntaxHighlighting } from '../../diff/viewer/syntaxHighlighting';
import { usePierreOptions } from './usePierreOptions';
import { useSurfaceVirtualizer } from './useSurfaceVirtualizer';
import styles from './TextSurface.module.css';
import { shownText } from '../../../lib/lineBreaks';

/**
 * A whole version of a file, highlighted and read-only; lone CRs break lines too. A big one is like a big read-only
 * diff: only the lines in view render, highlighted in Pierre's workers, and plain past what's worth it.
 */
export function ReadOnlyText({ path, text }: { path: string; text: string }) {
  const pierreOptions = usePierreOptions();
  const { virtualizer, surfaceRef, setSurface } = useSurfaceVirtualizer();
  const highlighting = syntaxHighlighting(text, '', false);
  const tokenizeMaxLength = highlighting === 'off' ? 0 : undefined;
  const workers = highlighting === 'background' ? highlightWorkers() : undefined;
  const options = useMemo(() => ({ ...pierreOptions, tokenizeMaxLength }), [pierreOptions, tokenizeMaxLength]);
  const file = useMemo(() => ({ name: path, lang: highlightedLanguage(highlighting, path), contents: shownText(text) }), [path, highlighting, text]);
  return (
    <div ref={setSurface} className={styles.surface}>
      <VirtualizerContext.Provider value={highlighting === 'inline' ? undefined : virtualizer}>
        <WorkerPoolContext.Provider value={workers}>
          {/* Pierre takes the workers and the virtualizer when it's created. */}
          <File key={highlighting} file={file} disableWorkerPool={!workers} options={options} />
        </WorkerPoolContext.Provider>
      </VirtualizerContext.Provider>
      <PaneScrollbars containerRef={surfaceRef} />
    </div>
  );
}
