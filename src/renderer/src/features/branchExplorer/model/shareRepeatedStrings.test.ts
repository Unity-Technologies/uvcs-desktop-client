import { describe, expect, it } from 'vitest';
import { sampleHistory } from './graphFixtures';
import { shareRepeatedStrings } from './shareRepeatedStrings';

describe('shareRepeatedStrings', () => {
  // Which copy a string is can't be seen from JavaScript: the heap snapshot shows the saving.
  it('keeps every value as it was', () => {
    const data = sampleHistory();
    data.mergeLinks.push({ type: 'cherryPick', sourceChangeset: 2, destinationChangeset: 7 });
    expect(shareRepeatedStrings(structuredClone(data))).toEqual(data);
  });
});
