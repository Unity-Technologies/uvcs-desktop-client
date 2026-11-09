import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder } from '../../src/shared/testing/filesUnder';

/**
 * No source, script or doc holds an invisible formatting character: the bidirectional controls a "Trojan Source"
 * attack hides code with (CVE-2021-42574), zero-width spaces and joiners, word joiners and a byte order mark. What is
 * read must be what runs, and the repository's security scanners refuse them. A text that needs one (an emoji joined
 * from several, a right-to-left case) writes it as an escape (`\u200D`).
 */

const ROOT = join(__dirname, '..', '..');
const SCANNED_DIRECTORIES = ['src', 'scripts', 'docs'];
const SCANNED_FILE = /\.(?:[cm]?[jt]sx?|css|html|md|json|ya?ml|sh)$/;
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/u;

function invisibleCharacters(text: string): string[] {
  return text
    .split('\n')
    .flatMap((line, index) => {
      const found = INVISIBLE.exec(line);
      return found ? [`line ${index + 1}: U+${found[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`] : [];
    });
}

describe('no invisible characters', () => {
  it('spots the bidirectional controls, zero-width characters and a byte order mark', () => {
    expect(invisibleCharacters('const access = "user\u202E \u2066// admin\u2069";')).toEqual(['line 1: U+202E']);
    expect(invisibleCharacters("const flag = '\u{1F3F3}\u{FE0F}\u200D\u{1F308}';")).toEqual(['line 1: U+200D']);
    expect(invisibleCharacters('\uFEFFimport x;')).toEqual(['line 1: U+FEFF']);
    expect(invisibleCharacters("const flag = '\\u{1F3F3}\\u{FE0F}\\u200D\\u{1F308}';")).toEqual([]);
  });

  it('no file holds one', () => {
    const offenders = SCANNED_DIRECTORIES.flatMap((directory) =>
      filesUnder(join(ROOT, directory), (name) => SCANNED_FILE.test(name)).flatMap((file) =>
        invisibleCharacters(readFileSync(file, 'utf8')).map((found) => `${relative(ROOT, file)} ${found}`),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
