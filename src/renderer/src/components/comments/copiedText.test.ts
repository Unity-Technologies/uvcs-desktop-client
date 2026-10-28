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

  it('leaves a part to what was copied inside it: a comment’s description selected whole, in the box holding its title too', () => {
    const description = 'Shelve pending\nBring 12 Switching keeps changes back';
    expect(copiedText({ selected: description, shown: SHOWN, source: SOURCE, withSources: 'Shelve pending\nBring cs:12 back', copiedInside: true })).toBeNull();
    expect(copiedText({ selected: SHOWN, shown: SHOWN, source: SOURCE, withSources: 'unused', copiedInside: true })).toBe(SOURCE);
  });
});
