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
    expect(source('features/diff/viewer/PaneScrollbars.tsx')).not.toMatch(/return null;/);
  });
});

/** The declarations of the rule written for `selector` alone, at the start of a line of `css`. */
function cssRule(css: string, selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  return start === -1 ? '' : css.slice(start, css.indexOf('}', start));
}
