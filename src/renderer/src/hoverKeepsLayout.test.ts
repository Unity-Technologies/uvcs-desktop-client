/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const RENDERER = __dirname;

/**
 * Declarations that change how much room a box takes. Under `:hover` they make a loop: the box grows, a wrapping row
 * moves it to the next line, out from under the pointer, the hover ends, it shrinks back under the pointer, and so on,
 * a flicker for as long as the pointer stays. What a hover reveals is laid over the box (`position: absolute`) or
 * kept in its room while hidden (`opacity`, `visibility`).
 */
const LAYOUT_PROPERTIES =
  /^(width|min-width|max-width|height|min-height|max-height|padding(-\w+)*|margin(-\w+)*|border(-\w+)?-width|font-size|font-weight|letter-spacing|gap|display)\s*:/;

/** A CSS file's rules as selector and declarations, `@media` blocks' included, comments left out. */
function cssRules(text: string): { selector: string; declarations: string[] }[] {
  const css = text.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector.trim().replace(/\s+/g, ' '),
    declarations: body.split(';').map((declaration) => declaration.trim()).filter(Boolean),
  }));
}

/** What a CSS file's hover rules change in the layout, as `selector { declaration }`. */
function layoutChangesOnHover(css: string): string[] {
  return cssRules(css)
    .filter((rule) => rule.selector.includes(':hover'))
    .flatMap((rule) => rule.declarations.filter((declaration) => LAYOUT_PROPERTIES.test(declaration)).map((declaration) => `${rule.selector} { ${declaration} }`));
}

function cssFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

describe('hovering', () => {
  // An attribute chip's edit and remove buttons once slid out on hover and widened it: the last chip of a line jumped
  // to the next one and back, over and over.
  it('never changes how much room a box takes', () => {
    const changes = cssFiles(RENDERER).flatMap((file) =>
      layoutChangesOnHover(readFileSync(file, 'utf8')).map((change) => `${relative(RENDERER, file)} ${change}`),
    );
    expect(changes).toEqual([]);
  });

  it('finds a hover rule that changes the layout, and leaves one that only paints', () => {
    const css = `
      .chip:hover .actions, .chip:focus-within .actions { max-width: 40px; opacity: 1; }
      .row:hover { background: var(--bg-hover); padding-right: 4px; }
      .row:focus-within { padding-right: 4px; }
    `;
    expect(layoutChangesOnHover(css)).toEqual([
      '.chip:hover .actions, .chip:focus-within .actions { max-width: 40px }',
      '.row:hover { padding-right: 4px }',
    ]);
  });
});
