import { Suspense } from 'react';
import { lazyComponent } from '../../lib/lazyComponent';
import { fenceLanguage } from './codeTokenStyle';

// The highlighter (Pierre's Shiki) loads on the first code block with a language, never at start-up.
const HighlightedCodeBlock = lazyComponent(() => import('./HighlightedCodeBlock').then((module) => module.HighlightedCodeBlock));

/**
 * A comment's code block: highlighted in its fence's language with the diffs' themes, plain until the grammar loads
 * and for a language the highlighter doesn't know. Both draw the same box, so nothing moves as colors arrive.
 */
export function CodeBlock({ text, language }: { text: string; language?: string }) {
  const lang = fenceLanguage(language);
  const plain = <PlainCodeBlock text={text} language={language} />;
  if (!lang) return plain;
  return (
    <Suspense fallback={plain}>
      <HighlightedCodeBlock text={text} language={lang} fallback={plain} />
    </Suspense>
  );
}

export function PlainCodeBlock({ text, language }: { text: string; language?: string }) {
  return (
    <pre data-language={language}>
      <code>{text}</code>
    </pre>
  );
}
