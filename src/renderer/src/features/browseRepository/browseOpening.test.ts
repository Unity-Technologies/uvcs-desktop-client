import { describe, expect, it } from 'vitest';
import { browseOpening, goToFileOpening } from './browseOpening';

const LINES = { side: 'new', first: 120, last: 121 } as const;

describe('browseOpening', () => {
  it('opens on the root with nothing selected', () => {
    expect(browseOpening({})).toEqual({ selected: null, expand: [], focus: null, fileView: null, showsDetails: false });
  });

  it('selects an item, its folders opened, in the view every file shares', () => {
    expect(browseOpening({ focusPath: 'src/ui/a.ts' })).toEqual({ selected: 'src/ui/a.ts', expand: ['src', 'src/ui'], focus: null, fileView: null, showsDetails: false });
  });

  it("shows a file's lines annotated, the page's own choice", () => {
    expect(browseOpening({ focusPath: 'src/a.ts', focusLines: LINES })).toEqual({
      selected: 'src/a.ts',
      expand: ['src'],
      focus: { path: 'src/a.ts', lines: LINES },
      fileView: 'annotate',
      showsDetails: true,
    });
  });

  it('ignores lines without an item', () => {
    expect(browseOpening({ focusLines: LINES }).focus).toBeNull();
  });
});

describe('goToFileOpening', () => {
  it('opens the tree on the item picked and clears the filter, which could hide it', () => {
    expect(goToFileOpening('src/ui/a.ts')).toEqual({
      opening: { selected: 'src/ui/a.ts', expand: ['src', 'src/ui'], focus: null, fileView: null, showsDetails: false },
      filter: '',
    });
  });
});
