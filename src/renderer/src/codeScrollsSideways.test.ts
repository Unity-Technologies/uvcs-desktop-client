import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

/** A component rendering code with Pierre: one of its React components that draws lines in panes. */
const RENDERS_PIERRE_CODE = /<(File|FileDiff|UnresolvedFile)\b[^>]*\b(file|fileDiff)=/;

/**
 * Where code is rendered by a component whose parent holds the scrolling element, and so the bars: the file that
 * renders `PaneScrollbars` for it.
 */
const BARS_HELD_BY: Record<string, string> = {
  'features/annotate/HighlightedCode.tsx': 'features/annotate/AnnotatedCode.tsx',
};

const source = (file: string): string => readFileSync(join(__dirname, ...file.split('/')), 'utf8');

/**
 * Pierre scrolls each pane of code sideways on its own, with a bar at the pane's end, out of sight and shown only while
 * hovered: every place that shows code with Pierre keeps the panes' bars at the bottom of its view (`PaneScrollbars`),
 * which also keeps the last line clear of them (`paneScrollbarsCss`).
 */
describe('code shown with Pierre', () => {
  it('has a horizontal scrollbar at the bottom of the view wherever it is shown', () => {
    const surfaces = filesUnder(__dirname, isAppSource)
      .map((file) => relative(__dirname, file).split(sep).join('/'))
      .filter((file) => RENDERS_PIERRE_CODE.test(source(file)));
    expect(surfaces.length).toBeGreaterThan(0);
    const withoutBars = surfaces.filter((file) => !source(BARS_HELD_BY[file] ?? file).includes('<PaneScrollbars '));
    expect(withoutBars).toEqual([]);
  });
});
