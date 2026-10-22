import { beforeEach, describe, expect, it } from 'vitest';
import { forgetSelectedLines, selectedLinesIn, selectLines, useSelectedLines } from './selectedLinesStore';

beforeEach(() => useSelectedLines.setState({ selected: null }));

describe('selected lines', () => {
  it('are the last ones selected, in the file they were selected in', () => {
    selectLines('src/a.cs', { side: 'new', first: 4, last: 9 });
    selectLines('src/b.cs', { side: 'old', first: 2, last: 2 });

    expect(useSelectedLines.getState().selected).toEqual({ path: 'src/b.cs', lines: { side: 'old', first: 2, last: 2 } });
    expect(selectedLinesIn('src/b.cs')).toEqual({ side: 'old', first: 2, last: 2 });
    expect(selectedLinesIn('src/a.cs')).toBeUndefined();
  });

  it('are none once the selection clears', () => {
    selectLines('src/a.cs', { side: 'new', first: 4, last: 9 });
    selectLines('src/a.cs', null);

    expect(useSelectedLines.getState().selected).toBeNull();
  });

  it("go with their file's diff, not with another file's leaving", () => {
    selectLines('src/b.cs', { side: 'new', first: 1, last: 1 });
    forgetSelectedLines('src/a.cs');
    expect(selectedLinesIn('src/b.cs')).toEqual({ side: 'new', first: 1, last: 1 });

    forgetSelectedLines('src/b.cs');
    expect(useSelectedLines.getState().selected).toBeNull();
  });
});
