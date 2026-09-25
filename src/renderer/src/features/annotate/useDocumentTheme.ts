import { useEffect, useState } from 'react';

export type DocumentTheme = 'light' | 'dark';

function currentTheme(): DocumentTheme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** The theme applied to the document (`data-theme`), kept up to date as the user or the OS changes it. */
export function useDocumentTheme(): DocumentTheme {
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
