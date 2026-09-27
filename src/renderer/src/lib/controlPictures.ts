/**
 * The text with its control characters (the separators `--format` puts between fields and records) shown as their
 * Unicode pictures (␟, ␞), which fonts draw, instead of as boxes; tabs and line breaks stay.
 */
export function withControlPictures(text: string): string {
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, (character) =>
    character === '\u007f' ? '␡' : String.fromCharCode(0x2400 + character.charCodeAt(0)),
  );
}
