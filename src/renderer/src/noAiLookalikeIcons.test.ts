import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

/**
 * Sparkles and magic wands have come to mean AI in most apps: something the app does by itself here reads as AI with
 * them. "Automatic" choices show what they do instead (`AUTOMATIC_CHOICE_ICON`: picked from the apps found), and a
 * conflict resolved automatically a double check.
 */
const AI_LOOKALIKES = /\b(Sparkles?|Sparkle|WandSparkles|Wand2?|MagicWand)\b/;

describe('icons', () => {
  it('never borrow the look of AI features', () => {
    const offenders = filesUnder(__dirname, isAppSource)
      .filter((file) => /^import\s[^;]*from 'lucide-react'/m.test(readFileSync(file, 'utf8')))
      .filter((file) => (readFileSync(file, 'utf8').match(/^import\s([^;]*)from 'lucide-react'/m)?.[1] ?? '').match(AI_LOOKALIKES))
      .map((file) => relative(__dirname, file));
    expect(offenders).toEqual([]);
  });
});
