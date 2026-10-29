import { Suspense } from 'react';
import { lazyComponent } from '../../lib/lazyComponent';
import { fenceLanguage, highlightedLanguage } from './codeBlockLanguage';

// The highlighter (Pierre's Shiki) loads on the first code block with a language, never at start-up.
const HighlightedCodeBlock = lazyComponent(() => import('./HighlightedCodeBlock').then((module) => module.HighlightedCodeBlock));

/**
 * A code block of a comment (or of release notes, an attribute's value): highlighted in its fence's language with the
 * diffs' themes (`highlightedLanguage`), plain until the grammar loads, for a language the highlighter doesn't know
 * and for a block too big to highlight on the page. Both draw the same box, so nothing moves as colors arrive.
 */
export function CodeBlock({ text, language }: { text: string; language?: string }) {
  const highlighted = highlightedLanguage(text, language);
  const plain = <PlainCodeBlock text={text} language={fenceLanguage(language)} />;
  if (!highlighted) return plain;
  return (
    <Suspense fallback={plain}>
      <HighlightedCodeBlock text={text} language={highlighted} fallback={plain} />
    </Suspense>
  );
}

export function PlainCodeBlock({ text, language }: { text: string; language: string | null }) {
  return (
    <pre data-language={language ?? undefined}>
      <code>{text}</code>
    </pre>
  );
}
