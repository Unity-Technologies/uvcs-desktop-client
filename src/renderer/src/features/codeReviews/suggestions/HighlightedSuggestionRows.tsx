import type { ReactNode } from 'react';
import { useHighlightedLines } from '../../../components/comments/HighlightedCodeBlock';
import type { SuggestionRow } from './suggestedChange';
import { suggestionLanguage } from './suggestionLanguage';
import { SuggestionRows } from './SuggestionRows';

interface HighlightedSuggestionRowsProps {
  rows: readonly SuggestionRow[];
  /** The file's: its language highlights the rows (`syntaxLanguage`). */
  path: string;
  fallback: ReactNode;
}

/**
 * The rows highlighted in the file's language, the removed and added lines as one text, so a line reads as it does in
 * the diff; plain until the grammar loads, for a language the highlighter doesn't know and past the size a comment's
 * code is highlighted to.
 */
export function HighlightedSuggestionRows({ rows, path, fallback }: HighlightedSuggestionRowsProps) {
  const text = rows.flatMap((row) => (row.kind === 'reading' ? [] : [row.text])).join('\n');
  const language = suggestionLanguage(text, path);
  const tokens = useHighlightedLines(text, language ?? 'text');
  if (!language || !tokens) return <>{fallback}</>;
  return <SuggestionRows rows={rows} tokens={tokens} />;
}
