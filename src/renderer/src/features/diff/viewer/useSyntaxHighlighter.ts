import { getHighlighterIfLoaded, preloadHighlighter, type DiffsThemeNames } from '@pierre/diffs';
import { useEffect, useState } from 'react';
import { syntaxLanguage } from '../../../lib/syntaxLanguage';

/**
 * True once Pierre's shared highlighter has the theme and the file's language loaded. Mounting a diff before that
 * renders it as plain text and relies on a late re-highlight, which Pierre drops if the diff input changed meanwhile
 * (e.g. the second side arriving), so a first diff of a new language could stay unhighlighted.
 */
export function useSyntaxHighlighter(theme: DiffsThemeNames, fileName: string): boolean {
  const language = syntaxLanguage(fileName);
  const isLoaded = (): boolean => getHighlighterIfLoaded({ theme, lang: language }) !== undefined;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const key = `${theme}:${language}`;

  useEffect(() => {
    if (isLoaded()) return;
    let current = true;
    // A language that fails to load still shows its diff, as plain text.
    const markLoaded = () => current && setLoadedKey(key);
    preloadHighlighter({ themes: [theme], langs: [language] }).then(markLoaded, markLoaded);
    return () => {
      current = false;
    };
  }, [key]);

  return loadedKey === key || isLoaded();
}
