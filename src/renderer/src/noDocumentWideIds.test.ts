import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

describe('element ids', () => {
  it('are never written out in a component: two views kept mounted may show the same one (useId instead)', () => {
    // A view kept mounted, hidden (`KeptView`), stays in the document: a literal id there names two elements, and
    // `aria-labelledby` or `getElementById` may reach the hidden one.
    const literalId = /\s(?:id|aria-labelledby|aria-describedby|aria-controls)="[^"]+"/;
    const offenders = ['features', 'components', 'app']
      .flatMap((folder) => filesUnder(join(__dirname, folder), isAppSource))
      .filter((file) => file.endsWith('.tsx') && literalId.test(readFileSync(file, 'utf8')))
      .map((file) => relative(__dirname, file));
    expect(offenders).toEqual([]);
  });
});
