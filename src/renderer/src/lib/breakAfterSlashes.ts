/**
 * `text` cut after each slash, the places a long path may wrap: a browser won't break a line at a slash, so a path
 * with no spaces would otherwise run past its box (`SlashBreakingText` puts a `<wbr>` between the parts). Joined, the
 * parts are `text` again.
 */
export function breakAfterSlashes(text: string): string[] {
  return text.split(/(?<=\/)/);
}
