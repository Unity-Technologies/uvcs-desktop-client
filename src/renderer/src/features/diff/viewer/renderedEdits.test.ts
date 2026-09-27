import { describe, expect, it } from 'vitest';
import { renderedEdits } from './renderedEdits';

const svg = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="${fill}"/></svg>\n`;
const onDisk = { text: svg('red'), imageDataUrl: `data:image/svg+xml;base64,${btoa(svg('red'))}`, isBinary: false, size: svg('red').length };

describe('renderedEdits', () => {
  it('draws the unsaved text as the image, in its own type', () => {
    const edited = renderedEdits(onDisk, svg('blue'));
    expect(edited.text).toBe(svg('blue'));
    expect(edited.imageDataUrl).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg('blue'))}`);
  });

  it('counts the size of the unsaved text in bytes', () => {
    expect(renderedEdits(onDisk, svg('ü')).size).toBe(new TextEncoder().encode(svg('ü')).length);
  });

  it('keeps a file that has no image as it is', () => {
    const text = { text: 'a\n', isBinary: false, size: 2 };
    expect(renderedEdits(text, 'b\n')).toBe(text);
  });
});
