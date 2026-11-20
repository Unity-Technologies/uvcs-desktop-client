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
import { useDiffShadowRoot } from '../../diff/viewer/useDiffShadowRoot';
import { useWordMarks, type WordMarkColors } from '../../diff/viewer/useWordMarks';
import type { WordMarksByLine } from '../../diff/viewer/wordMarkRows';
import { stackedWordMarks } from './stackedWordMarks';
import { SuggestionPlaceholder } from './SuggestionPlaceholder';
import { useSuggestionViewStore } from './suggestionViewStore';
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
  const { replacedText, suggestedText, firstLine } = body;
  const view = useSuggestionViewStore((state) => state.view);
  const fileDiff = useMemo(() => suggestionFileDiff(path, { replacedText, suggestedText, firstLine }, view), [path, replacedText, suggestedText, firstLine, view]);
  const options = useMemo(() => pierreSnippetDiffOptions(theme), [theme]);
  const container = useRef<HTMLDivElement | null>(null);
  // Stacked, the words are marked over the rows, as the line diff pairs the lines (Pierre would pair them by position).
  const wordMarks = useMemo(() => (view === 'stacked' ? stackedWordMarks(replacedText, suggestedText, firstLine) : NO_WORD_MARKS), [view, replacedText, suggestedText, firstLine]);
  useWordMarks(container, useDiffShadowRoot(container), wordMarks, DIFF_WORD_COLORS);
  const holdContainer = useCallback((element: HTMLDivElement | null) => {
    container.current = element;
    return keepCodePointerToItself(element);
  }, []);
  if (!highlighterReady) return <SuggestionPlaceholder rowCount={fileDiff.unifiedLineCount} />;
  return (
    <div ref={holdContainer} className={styles.diff}>
      <VirtualizerContext.Provider value={undefined}>
        <FileDiff fileDiff={fileDiff} options={options} disableWorkerPool />
      </VirtualizerContext.Provider>
      <PaneScrollbars containerRef={container} />
    </div>
  );
}

const NO_WORD_MARKS: WordMarksByLine = { deletions: new Map(), additions: new Map() };

/** Pierre's own colors for the words it marks, so the stacked marks read as the code's diff's. */
const DIFF_WORD_COLORS: WordMarkColors = { deletions: 'var(--diffs-bg-deletion-emphasis)', additions: 'var(--diffs-bg-addition-emphasis)' };
