/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { paneBarOf, paneOverflows, paneScrollbarsCss, samePaneBars, showsPaneBars, type PaneBar } from './paneScrollbarsLayout';

const pane = (width: number, scrollWidth: number, left = 0): PaneBar => ({ left, width, scrollWidth });

describe('paneOverflows', () => {
  it('needs a bar when the lines are wider than the pane', () => {
    expect(paneOverflows(pane(600, 1400))).toBe(true);
  });

  it('needs none when the lines fit, or overflow only by the pixel a width rounds off', () => {
    expect(paneOverflows(pane(600, 600))).toBe(false);
    expect(paneOverflows(pane(600, 601))).toBe(false);
    expect(paneOverflows(pane(600, 602))).toBe(true);
  });
});

describe('showsPaneBars', () => {
  it('shows the bars when any pane overflows, even if the other fits', () => {
    expect(showsPaneBars([pane(600, 600), pane(600, 1400, 610)])).toBe(true);
  });

  it('shows none when every pane fits, or there are no panes yet', () => {
    expect(showsPaneBars([pane(600, 600), pane(600, 590, 610)])).toBe(false);
    expect(showsPaneBars([])).toBe(false);
  });
});

describe('samePaneBars', () => {
  it('is the same when every pane is where it was, as wide, with code as wide', () => {
    expect(samePaneBars([pane(600, 1400)], [pane(600, 1400)])).toBe(true);
  });

  it('differs when a pane moved, resized, its code widened, or a pane came or went', () => {
    expect(samePaneBars([pane(600, 1400)], [pane(600, 1400, 4)])).toBe(false);
    expect(samePaneBars([pane(600, 1400)], [pane(500, 1400)])).toBe(false);
    expect(samePaneBars([pane(600, 1400)], [pane(600, 1500)])).toBe(false);
    expect(samePaneBars([pane(600, 1400)], [pane(600, 1400), pane(600, 1400, 610)])).toBe(false);
  });
});

/** Pierre's own style sheet, as the installed @pierre/diffs ships it (it isn't one of the package's exports). */
const PIERRE_CSS = readFileSync(join(__dirname, '..', '..', '..', '..', '..', '..', 'node_modules', '@pierre', 'diffs', 'dist', 'style.js'), 'utf8');
const PIERRE_GAP = 'var(--diffs-gap-block,var(--diffs-gap-fallback))';

describe('paneScrollbarsCss', () => {
  it('tells Pierre the panes have no scrollbar of their own, so the code ends with the same gap it starts with', () => {
    for (const showsBars of [false, true]) expect(paneScrollbarsCss(showsBars)).toContain(':host{--diffs-scrollbar-gutter-override:0px}');
  });

  it("leaves room for the bars under the last line while they show, past the gap, and none while they don't", () => {
    expect(paneScrollbarsCss(true)).toContain(`[data-code]{padding-bottom:calc(${PIERRE_GAP} + var(--scrollbar-size))}`);
    expect(paneScrollbarsCss(false)).not.toContain('padding-bottom');
  });

  // What the styles above rely on in Pierre's own: an update that changes it has the panes' bottoms checked again.
  it('relies on Pierre padding the code by its gap above, and by the gap less its scrollbar gutter below, which the override sets', () => {
    expect(PIERRE_CSS).toContain('--diffs-scrollbar-gutter:var(--diffs-scrollbar-gutter-override,');
    expect(PIERRE_CSS).toContain(`padding-top:${PIERRE_GAP}`);
    expect(PIERRE_CSS).toContain(`padding-bottom:max(0px, calc(${PIERRE_GAP} - var(--diffs-scrollbar-gutter)))`);
    expect(PIERRE_CSS).toContain('[data-code]::-webkit-scrollbar{width:0;height:var(--diffs-scrollbar-gutter)}');
  });
});

describe('paneBarOf', () => {
  const container = { left: 100, clientLeft: 0, scrollLeft: 0 };

  it('puts a pane\'s bar where the pane is across the container, as wide as it, measuring its code', () => {
    expect(paneBarOf({ left: 160, clientWidth: 500, scrollWidth: 1400 }, container)).toEqual({ left: 60, width: 500, scrollWidth: 1400 });
  });

  it('measures from inside the container\'s border, so a framed container gets no sideways scroll of its own', () => {
    expect(paneBarOf({ left: 101, clientWidth: 500, scrollWidth: 1400 }, { ...container, clientLeft: 1 })).toEqual({ left: 0, width: 500, scrollWidth: 1400 });
  });

  it('counts what the container itself is scrolled sideways', () => {
    expect(paneBarOf({ left: 60, clientWidth: 500, scrollWidth: 1400 }, { ...container, scrollLeft: 40 })).toEqual({ left: 0, width: 500, scrollWidth: 1400 });
  });
});
