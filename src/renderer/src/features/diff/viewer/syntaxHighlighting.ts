import type { SupportedLanguages } from '@pierre/diffs';
import { syntaxLanguage } from '../../../lib/syntaxLanguage';

/**
 * How a diff is syntax highlighted: `inline` on the main thread before it shows, `background` in Pierre's workers
 * after it shows as plain text, or `off` (plain text).
 */
export type SyntaxHighlighting = 'inline' | 'background' | 'off';

/**
 * How much text (both versions together) an editable diff highlights on the main thread, where Pierre highlights
 * editors whatever the workers could do. Shiki reads whole files at once and the app waits, about 1.5 to 4 ms a KB
 * (dense generated code to real TSX): 0.1 s for 2 x 16 KB, 0.57 s for 2 x 156 KB. Past this, plain text.
 */
export const MAX_HIGHLIGHTED_CHARS = 400_000;

/**
 * How much text a read-only diff highlights on the main thread before it shows: about 0.1 s here (2 x 10 KB of real
 * TSX took 86 to 104 ms, 2 x 14 KB 110 to 120 ms, 2 x 64 KB 0.63 s). Past this it shows as plain text at once and its
 * colors come from Pierre's workers a moment later, without a pause.
 */
export const MAX_READ_ONLY_HIGHLIGHTED_CHARS = 20_000;

/**
 * How much text a read-only diff highlights in the background. The workers take about 2 s a megabyte and 150 MB of
 * memory a megabyte, and the app pauses about 0.13 s a megabyte to take the highlighted lines in: past this (about 8 s,
 * half a second and 600 MB), plain text. Text past 10 MB a side (`MAX_TEXT_BYTES`) doesn't reach a diff at all.
 */
export const MAX_BACKGROUND_HIGHLIGHTED_CHARS = 4_000_000;

/**
 * How a diff of these texts is highlighted. Pierre highlights an editable diff (and the whole-file editor) on the main
 * thread whatever the workers could do, so only read-only diffs go to the background.
 */
export function syntaxHighlighting(original: string, modified: string, editable: boolean): SyntaxHighlighting {
  const size = original.length + modified.length;
  if (size <= (editable ? MAX_HIGHLIGHTED_CHARS : MAX_READ_ONLY_HIGHLIGHTED_CHARS)) return 'inline';
  return !editable && size <= MAX_BACKGROUND_HIGHLIGHTED_CHARS ? 'background' : 'off';
}

/**
 * The language to give Pierre for a diff highlighted so: plain text is the "text" language too, since the editor colors
 * the lines it renders again as they're typed by the language, whatever the diff around them shows.
 */
export function highlightedLanguage(highlighting: SyntaxHighlighting, fileName: string): SupportedLanguages {
  return highlighting === 'off' ? 'text' : syntaxLanguage(fileName);
}
