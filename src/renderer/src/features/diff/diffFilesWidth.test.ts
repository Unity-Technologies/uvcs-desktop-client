import { describe, expect, it } from 'vitest';
import { DIFF_FILES_WIDTH, diffFilesWidthKey, pageDiffFilesWidthOf } from './diffFilesWidth';

describe('diffFilesWidthKey', () => {
  it("keeps a dialog's files apart from the pages': a dialog is narrower than the window", () => {
    expect(diffFilesWidthKey(true)).not.toBe(diffFilesWidthKey(false));
  });
});

describe('pageDiffFilesWidthOf', () => {
  it("is the width a page's files beside a diff were last left at: widened for a merge request, they're as wide for the next changeset", () => {
    expect(pageDiffFilesWidthOf({ widths: { [diffFilesWidthKey(false)]: 520 } })).toBe(520);
  });

  it('is the default until they are dragged, or when only a dialog was', () => {
    expect(pageDiffFilesWidthOf({ widths: {} })).toBe(DIFF_FILES_WIDTH.initial);
    expect(pageDiffFilesWidthOf({ widths: { [diffFilesWidthKey(true)]: 500 } })).toBe(DIFF_FILES_WIDTH.initial);
  });
});
