import { describe, expect, it } from 'vitest';
import { activeGuideLevelAt, activeIndentGuide } from './indentGuides';

interface Row {
  level: number;
  open?: boolean;
}

// A changelist (0) holding a folder (1) with two files (2), then a file (1); then a top-level file.
const rows: Row[] = [{ level: 0, open: true }, { level: 1, open: true }, { level: 2 }, { level: 2 }, { level: 1 }, { level: 0 }];
const guideRows = { rows, levelOf: (row: Row) => row.level, isOpenHeader: (row: Row) => row.open === true };

describe('activeIndentGuide', () => {
  it("lights the guide of the folder holding a file, down every row it holds", () => {
    expect(activeIndentGuide(guideRows, 2)).toEqual({ level: 1, from: 2, to: 4 });
    expect(activeIndentGuide(guideRows, 4)).toEqual({ level: 0, from: 1, to: 5 });
  });

  it("lights an open folder's own guide when it is selected", () => {
    expect(activeIndentGuide(guideRows, 1)).toEqual({ level: 1, from: 2, to: 4 });
  });

  it('lights none for a top-level row, a closed folder at the top, or no selection', () => {
    expect(activeIndentGuide(guideRows, 5)).toBeNull();
    expect(activeIndentGuide({ ...guideRows, rows: [{ level: 0 }] }, 0)).toBeNull();
    expect(activeIndentGuide(guideRows, -1)).toBeNull();
  });

  it('lights none for an open folder holding nothing shown', () => {
    expect(activeIndentGuide({ ...guideRows, rows: [{ level: 0, open: true }, { level: 0 }] }, 0)).toBeNull();
  });
});

describe('activeGuideLevelAt', () => {
  it('names the level for the rows the guide runs through, and nothing elsewhere', () => {
    const guide = activeIndentGuide(guideRows, 2);
    expect(rows.map((_, index) => activeGuideLevelAt(guide, index))).toEqual([undefined, undefined, 1, 1, undefined, undefined]);
  });
});
