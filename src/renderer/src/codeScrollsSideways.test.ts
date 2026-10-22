import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

/** Pierre's React components that draw code in panes. */
const CODE_COMPONENTS = ['File', 'FileDiff', 'UnresolvedFile'];

/**
 * Where code is rendered by a component whose parent holds the scrolling element, and so the bars: the file that
 * renders `PaneScrollbars` for it.
 */
const BARS_HELD_BY: Record<string, string> = {
  'features/annotate/HighlightedCode.tsx': 'features/annotate/AnnotatedCode.tsx',
};

const source = (file: string): string => readFileSync(join(__dirname, ...file.split('/')), 'utf8');

/** Whether `file` imports, as a value (to render it, not `import type`), one of Pierre's code components, aliased or not. */
function rendersPierreCode(file: string): boolean {
  return [...source(file).matchAll(/^import\s+(?!type\b)\{([^}]*)\}\s+from\s+'@pierre\/diffs\/react';/gm)].some((match) =>
    match[1]!
      .split(',')
      .map((name) => name.trim())
      .filter((name) => !name.startsWith('type '))
      .some((name) => CODE_COMPONENTS.includes(name.split(/\s+as\s+/)[0]!)),
  );
}

const SURFACES = filesUnder(__dirname, isAppSource)
  .map((file) => relative(__dirname, file).split(sep).join('/'))
  .filter(rendersPierreCode)
  .sort();

/**
 * Pierre scrolls each pane of code sideways on its own, with a bar at the pane's end, out of sight and shown only while
 * hovered: every place that shows code with Pierre keeps the panes' bars at the bottom of its view (`PaneScrollbars`),
 * which also keeps the last line clear of them (`paneScrollbarsCss`).
 */
describe('code shown with Pierre', () => {
  it('is found wherever the app shows it', () => {
    expect(SURFACES).toEqual(
      expect.arrayContaining([
        'features/annotate/HighlightedCode.tsx',
        'features/diff/viewer/MovedCodeDialog.tsx',
        'features/diff/viewer/TextDiff.tsx',
        'features/merge/resolve/ConflictHunks.tsx',
        'features/merge/resolve/HandEditor.tsx',
        'features/merge/resolve/ReadOnlyText.tsx',
      ]),
    );
  });

  it('has a horizontal scrollbar at the bottom of the view wherever it is shown', () => {
    const withoutBars = SURFACES.filter((file) => !source(BARS_HELD_BY[file] ?? file).includes('<PaneScrollbars '));
    expect(withoutBars).toEqual([]);
  });

  // The view's own bar would show under the panes' while anything in it stuck out sideways, as the bars did for the
  // frames a resize takes to measure them again: the bars are clipped to the view, and the view, whichever it is,
  // never scrolls sideways while `PaneScrollbars` is in it (mounted, it always renders its bars' element).
  it('never scrolls sideways itself: only its panes do', () => {
    const css = source('features/diff/viewer/PaneScrollbars.module.css');
    expect(cssRule(css, 'div:has(> .bars)')).toMatch(/overflow-x: hidden;/);
    expect(cssRule(css, '.bars')).toMatch(/overflow: hidden;/);
  });

  // `div:has(> .bars)` outranks a single class, which is how each view sets its own `overflow: auto`, and no more.
  it("sets its own overflow through a single class, which the bars' rule outranks", () => {
    const overriding = Object.entries(HOST_SCROLLER_STYLES).flatMap(([file, scroller]) => {
      const css = source(file);
      expect(cssRule(css, scroller)).toMatch(/overflow: auto;/);
      return [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
        .filter((rule) => /(^|[\s;])overflow(-x)?:/.test(rule[2]!))
        .map((rule) => rule[1]!.replace(/\/\*[\s\S]*?\*\//g, '').trim())
        .filter((selector) => !/^\.[\w-]+$/.test(selector))
        .map((selector) => `${file}: ${selector}`);
    });
    expect(overriding).toEqual([]);
  });
});

/** The style sheets of the views that hold code with Pierre and `PaneScrollbars`, with their scrolling element's class. */
const HOST_SCROLLER_STYLES: Record<string, string> = {
  'features/diff/viewer/TextDiff.module.css': '.diff',
  'features/merge/resolve/TextSurface.module.css': '.surface',
  'features/annotate/AnnotatedCode.module.css': '.scroller',
  'features/diff/viewer/MovedCodeDialog.module.css': '.diff',
};

/** The declarations of the rule written for `selector` alone, at the start of a line of `css`. */
function cssRule(css: string, selector: string): string {
  const lines = `\n${css}`;
  const start = lines.indexOf(`\n${selector} {`);
  return start === -1 ? '' : lines.slice(start, lines.indexOf('}', start));
}
