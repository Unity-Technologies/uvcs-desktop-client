import { getSharedHighlighter, type ThemedToken } from '@pierre/diffs';
import { useEffect, useState, type ReactNode } from 'react';
import { useResolvedTheme } from '../../app/settings/useResolvedTheme';
import { pierreThemeName } from '../../lib/codeTheme';
import { codeTokenStyle } from './codeTokenStyle';

/** No line is tokenized past this many characters (a minified one), as Pierre's diffs do. */
const TOKENIZED_LINE_LENGTH = 1000;
/** Highlighted blocks kept, so a block shown again (a selection back, a theme switched back) is never tokenized again. */
const KEPT_BLOCKS = 50;

const highlightedBlocks = new Map<string, ThemedToken[][]>();

/** A block's highlighted lines, and what they are of: only another theme's may stand in while the new one arrives. */
interface Shown {
  text: string;
  language: string;
  lines: ThemedToken[][];
}

interface HighlightedCodeBlockProps {
  text: string;
  /** As `highlightedLanguage` names it. */
  language: string;
  /** What shows until the grammar loads, and for a language the highlighter doesn't know. */
  fallback: ReactNode;
}

/**
 * A code block highlighted by the highlighter the diffs share (`getSharedHighlighter`), in the app's theme. Each run
 * ignores its result once a newer run or the unmount took over (StrictMode mounts twice); until the new theme's
 * colors arrive, the last ones stay.
 */
export function HighlightedCodeBlock({ text, language, fallback }: HighlightedCodeBlockProps) {
  const theme = pierreThemeName(useResolvedTheme());
  const key = `${theme}\n${language}\n${text}`;
  const [shown, setShown] = useState<Shown | null>(() => keptBlock(key, text, language));

  useEffect(() => {
    const kept = keptBlock(key, text, language);
    if (kept) {
      setShown(kept);
      return;
    }
    let current = true;
    void (async () => {
      try {
        const highlighter = await getSharedHighlighter({ themes: [theme], langs: [] });
        await highlighter.loadLanguages([language]);
        const { tokens } = highlighter.codeToTokens(text, { lang: language, theme, tokenizeMaxLineLength: TOKENIZED_LINE_LENGTH });
        keepBlock(key, tokens);
        if (current) setShown({ text, language, lines: tokens });
      } catch {
        // A language the highlighter doesn't know: the block stays plain.
      }
    })();
    return () => {
      current = false;
    };
  }, [key, text, language, theme]);

  if (!shown || shown.text !== text || shown.language !== language) return fallback;
  return (
    <pre data-language={language}>
      <code>
        {shown.lines.map((line, index) => (
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

function keptBlock(key: string, text: string, language: string): Shown | null {
  const lines = highlightedBlocks.get(key);
  return lines ? { text, language, lines } : null;
}

function keepBlock(key: string, lines: ThemedToken[][]): void {
  highlightedBlocks.delete(key);
  highlightedBlocks.set(key, lines);
  if (highlightedBlocks.size > KEPT_BLOCKS) highlightedBlocks.delete(highlightedBlocks.keys().next().value!);
}
