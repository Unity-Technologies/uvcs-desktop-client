import { describe, expect, it } from 'vitest';
import { selectionInks } from './drawNodeSelection';
import type { GraphPalette } from './graphPalette';

const palette = { accent: 'blue', accentSoft: 'pale blue', multipleSelection: 'magenta', multipleSelectionSoft: 'pale magenta' } as GraphPalette;

describe('selectionInks', () => {
  it('draws one thing selected in the accent', () => {
    expect(selectionInks({ palette, multipleSelection: false })).toEqual({ ring: 'blue', halo: 'pale blue' });
  });

  it('draws several in magenta, so a selection of many never reads as one', () => {
    expect(selectionInks({ palette, multipleSelection: true })).toEqual({ ring: 'magenta', halo: 'pale magenta' });
  });
});
