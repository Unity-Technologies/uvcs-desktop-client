import { FileDiff, VirtualizerContext } from '@pierre/diffs/react';
import { useCallback, useMemo, useRef } from 'react';
import { useResolvedTheme } from '../../../app/settings/useResolvedTheme';
import { pierreThemeName } from '../../../lib/codeTheme';
import { PaneScrollbars } from '../../diff/viewer/PaneScrollbars';
import { keepCodePointerToItself } from '../../diff/viewer/pierreDom';
import { pierreSnippetDiffOptions } from '../../diff/viewer/pierreOptions';
import { useSyntaxHighlighter } from '../../diff/viewer/useSyntaxHighlighter';
import type { SuggestionBody } from './suggestedChange';
import { suggestionFileDiff } from './suggestionFileDiff';
import { SuggestionPlaceholder } from './SuggestionPlaceholder';
import styles from './SuggestedChangeBlock.module.css';

interface SuggestionDiffProps {
  path: string;
  body: Extract<SuggestionBody, { kind: 'diff' }>;
}

/**
 * A suggestion's lines as Pierre's diff (`suggestionFileDiff`, `pierreSnippetDiffOptions`): the code diff's colors and word
 * marks, highlighted in the file's language once Pierre's shared highlighter has it (its place held until then, as the
 * diff viewer's `useSyntaxHighlighter` waits). A few lines, so drawn whole on the main thread: no virtualizer, even
 * inside the code's diff, whose own would take it for one of its files, and no workers. A long line scrolls sideways
 * with the bar every code view has (`PaneScrollbars`), there only when a line overflows, so the last row otherwise
 * meets the box's border (Pierre's own bar would keep its height under it, empty).
 */
export function SuggestionDiff({ path, body }: SuggestionDiffProps) {
  const theme = useResolvedTheme();
  const highlighterReady = useSyntaxHighlighter(pierreThemeName(theme), path);
  const { replacedText, suggestedText } = body;
  const fileDiff = useMemo(() => suggestionFileDiff(path, { replacedText, suggestedText }), [path, replacedText, suggestedText]);
  const options = useMemo(() => pierreSnippetDiffOptions(theme), [theme]);
  const container = useRef<HTMLDivElement | null>(null);
  const holdContainer = useCallback((element: HTMLDivElement | null) => {
    container.current = element;
    return keepCodePointerToItself(element);
  }, []);
  if (!highlighterReady) return <SuggestionPlaceholder rowCount={body.rowCount} />;
  return (
    <div ref={holdContainer} className={styles.diff}>
      <VirtualizerContext.Provider value={undefined}>
        <FileDiff fileDiff={fileDiff} options={options} disableWorkerPool />
      </VirtualizerContext.Provider>
      <PaneScrollbars containerRef={container} />
    </div>
  );
}
