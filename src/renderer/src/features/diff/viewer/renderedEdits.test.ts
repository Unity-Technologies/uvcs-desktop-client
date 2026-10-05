import { describe, expect, it } from 'vitest';
import { renderedEdits } from './renderedEdits';

const svg = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="${fill}"/></svg>\n`;
const onDisk = { text: svg('red'), image: { bytes: new TextEncoder().encode(svg('red')), mimeType: 'image/svg+xml' }, isBinary: false, size: svg('red').length };

describe('renderedEdits', () => {
  it('draws the unsaved text as the image, in its own type', () => {
    const edited = renderedEdits(onDisk, svg('blue'));
    expect(edited.text).toBe(svg('blue'));
    expect(edited.image?.mimeType).toBe('image/svg+xml');
    expect(new TextDecoder().decode(edited.image?.bytes)).toBe(svg('blue'));
  });

  it('counts the size of the unsaved text in bytes', () => {
    expect(renderedEdits(onDisk, svg('ü')).size).toBe(new TextEncoder().encode(svg('ü')).length);
  });

  it('draws the unsaved text of a model written as text (OBJ) as the model', () => {
    const obj = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';
    const saved = { text: obj, model: { bytes: new TextEncoder().encode(obj), format: 'obj' as const }, isBinary: false, size: obj.length };
    const edited = renderedEdits(saved, obj.replace('v 1 0 0', 'v 2 0 0'));
    expect(edited.model?.format).toBe('obj');
    expect(new TextDecoder().decode(edited.model?.bytes)).toContain('v 2 0 0');
  });

  it('keeps a file that has no image as it is', () => {
    const text = { text: 'a\n', isBinary: false, size: 2 };
    expect(renderedEdits(text, 'b\n')).toBe(text);
  });
});
