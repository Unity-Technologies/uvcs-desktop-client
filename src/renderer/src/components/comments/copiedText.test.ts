import { describe, expect, it } from 'vitest';
import { copiedText } from './copiedText';

const SOURCE = 'Fix **the switch**\n\n- Shelve `pending`\n- Bring cs:12 back';
const SHOWN = 'Fix the switch\nShelve pending\nBring 12 Switching keeps changes back';

describe('copiedText', () => {
  it('gives back the comment exactly as written when the selection holds all of it: its marks, list markers and backticks', () => {
    expect(copiedText({ selected: SHOWN, shown: SHOWN, source: SOURCE, withSources: 'unused' })).toBe(SOURCE);
    expect(copiedText({ selected: `  ${SHOWN}\n`, shown: SHOWN, source: SOURCE, withSources: 'unused' })).toBe(SOURCE);
  });

  it('gives a part of it as it reads, its references as written (a chip its spec)', () => {
    expect(copiedText({ selected: 'Bring 12 Switching keeps changes back', shown: SHOWN, source: SOURCE, withSources: 'Bring cs:12 back' })).toBe('Bring cs:12 back');
  });
});
