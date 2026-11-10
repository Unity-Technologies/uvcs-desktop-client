import { describe, expect, it } from 'vitest';
import { contextThreadParts, THREAD_ROW } from './contextThreadRow';

describe('contextThreadParts', () => {
  it('shows the thread under its line, its line outlined as the one selected', () => {
    expect(contextThreadParts('additions', 75, true)).toEqual({
      rows: [{ side: 'additions', lineNumber: 75, metadata: THREAD_ROW }],
      marked: false,
      bands: [{ key: 'additions:75', side: 'additions', lineNumber: 75, selected: true }],
    });
  });

  it('hidden, leaves the code alone but for a marker on the line, which keeps its outline', () => {
    expect(contextThreadParts('deletions', 12, false)).toEqual({
      rows: [],
      marked: true,
      bands: [{ key: 'deletions:12', side: 'deletions', lineNumber: 12, selected: true }],
    });
  });
});
