import { getSharedHighlighter, type ThemedToken } from '@pierre/diffs';
import { useEffect, useState, type ReactNode } from 'react';
import { useResolvedTheme } from '../../app/settings/useResolvedTheme';
import { pierreThemeName } from '../../lib/codeTheme';
import { codeTokenStyle } from './codeTokenStyle';

interface HighlightedCodeBlockProps {
  text: string;
  /** As the fence names it (`fenceLanguage`). */
  language: string;
  /** What shows until the grammar loads, and for a language the highlighter doesn't know. */
  fallback: ReactNode;
}

/**
 * A comment's code highlighted by the highlighter the diffs share (`getSharedHighlighter`), in the app's theme. Each
 * run builds its own result and ignores it once a newer run or the unmount took over (StrictMode mounts twice).
 */
export function HighlightedCodeBlock({ text, language, fallback }: HighlightedCodeBlockProps) {
  const theme = pierreThemeName(useResolvedTheme());
  const [lines, setLines] = useState<ThemedToken[][] | null>(null);

  useEffect(() => {
    let current = true;
    setLines(null);
    void (async () => {
      try {
        const highlighter = await getSharedHighlighter({ themes: ['pierre-light', 'pierre-dark'], langs: [] });
        await highlighter.loadLanguages([language]);
        const { tokens } = highlighter.codeToTokens(text, { lang: language, theme });
        if (current) setLines(tokens);
      } catch {
        // A language the highlighter doesn't know: the block stays plain.
      }
    })();
    return () => {
      current = false;
    };
  }, [text, language, theme]);

  if (!lines) return fallback;
  return (
    <pre data-language={language}>
      <code>
        {lines.map((line, index) => (
          <span key={index}>
            {index > 0 && '\n'}
            {line.map((token, tokenIndex) => (
              <span key={tokenIndex} style={codeTokenStyle(token)}>
                {token.content}
              </span>
            ))}
          </span>
        ))}
      </code>
    </pre>
  );
}
