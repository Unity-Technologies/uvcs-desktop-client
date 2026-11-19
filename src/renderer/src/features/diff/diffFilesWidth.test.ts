import { describe, expect, it } from 'vitest';
import { DIFF_FILES_WIDTH, diffFilesWidthKey, pageDiffFilesWidthOf } from './diffFilesWidth';

describe('diffFilesWidthKey', () => {
  it("shares one width among every page's files beside a diff: widened for a merge request, they're as wide for the next changeset", () => {
    expect(diffFilesWidthKey(true)).toBe(diffFilesWidthKey(true));
  });

  it("keeps a dialog's files apart from the pages': a dialog is narrower than the window", () => {
    expect(diffFilesWidthKey(false)).not.toBe(diffFilesWidthKey(true));
  });
});

describe('pageDiffFilesWidthOf', () => {
  it('is the width the files beside a diff were last left at', () => {
    expect(pageDiffFilesWidthOf({ widths: { [diffFilesWidthKey(true)]: 520 } })).toBe(520);
  });

  it('is the default until they are dragged, or when only a dialog was', () => {
    expect(pageDiffFilesWidthOf({ widths: {} })).toBe(DIFF_FILES_WIDTH.initial);
    expect(pageDiffFilesWidthOf({ widths: { [diffFilesWidthKey(false)]: 500 } })).toBe(DIFF_FILES_WIDTH.initial);
  });
});
