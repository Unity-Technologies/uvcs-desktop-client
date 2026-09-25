import { LanguageDescription, type LanguageSupport } from '@codemirror/language';
import { languages } from '@codemirror/language-data';

/** Loads syntax highlighting for a file name, or resolves to null when the language is unknown. */
export async function loadLanguageForFile(fileName: string): Promise<LanguageSupport | null> {
  const description = LanguageDescription.matchFilename(languages, fileName);
  return description ? description.load() : null;
}
