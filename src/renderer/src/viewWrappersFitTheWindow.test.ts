import { describe, expect, it } from 'vitest';
import { cssRules, readWrapperCss, VIEW_WRAPPERS, type ViewWrapperFile } from './testing/viewWrappers';

/**
 * A flex item's least size along its parent's direction is its content's, unless it says otherwise: a box that grows
 * to fill the window (`flex: 1`) and holds more than fits grows past it instead, and every list and diff inside, given
 * all the room they ask for, has nothing to scroll. A box can't tell which way its parent lays out, and a wrapper may
 * move into another, so each one that grows lets its content be smaller than it is both ways: `min-width: 0` and
 * `min-height: 0`, or an `overflow` that clips.
 */
const GROWS = /^(flex:\s*([1-9]|auto\b)|flex-grow:\s*[1-9])/;
const LETS_CONTENT_SHRINK = { width: /^min-width:\s*0(px)?$/, height: /^min-height:\s*0(px)?$/, both: /^overflow:\s*(hidden|auto|scroll|clip)$/ };

/** Classes that are only ever set beside another, whose rules they share: `SplitPane`'s `.rest` is always a `.pane`. */
const ALWAYS_WITH: Record<string, string> = { 'ui/SplitPane.module.css:rest': 'pane' };

/** The declarations of a class's own rule, without a state (`[hidden]`), a child or a pseudo-element. */
function ownDeclarations(css: string, className: string): string[] {
  return cssRules(css)
    .filter((rule) => rule.selector.split(',').some((part) => part.trim() === `.${className}`))
    .flatMap((rule) => rule.declarations);
}

/** Which way a wrapper that grows holds its content's size, as `.class (width|height)`; nothing for one that doesn't grow. */
function holdsContentIn(css: string, className: string, sharedWith?: string): string[] {
  const declarations = [...ownDeclarations(css, className), ...(sharedWith ? ownDeclarations(css, sharedWith) : [])];
  if (!declarations.some((declaration) => GROWS.test(declaration))) return [];
  if (declarations.some((declaration) => LETS_CONTENT_SHRINK.both.test(declaration))) return [];
  return (['width', 'height'] as const)
    .filter((axis) => !declarations.some((declaration) => LETS_CONTENT_SHRINK[axis].test(declaration)))
    .map((axis) => `.${className} (${axis})`);
}

function wrappersHoldingContent({ file, classes }: ViewWrapperFile): string[] {
  const css = readWrapperCss(file);
  return classes.flatMap((className) => holdsContentIn(css, className, ALWAYS_WITH[`${file}:${className}`]).map((found) => `${file} ${found}`));
}

describe('the boxes the views sit in', () => {
  // `PageFrame`'s `.frame` once had no `min-height: 0`: in the column `.layer` a merge in progress stays mounted in, a
  // merge with more items than the window shows grew the page past it, and neither its list nor its diff scrolled.
  it('never grow past the window, so what holds more than fits scrolls', () => {
    expect(VIEW_WRAPPERS.flatMap(wrappersHoldingContent)).toEqual([]);
  });

  it('reads how a box holds its content as CSS writes it', () => {
    expect(holdsContentIn('.frame { display: flex; flex: 1; min-width: 0; }', 'frame')).toEqual(['.frame (height)']);
    expect(holdsContentIn('.frame { flex: 1 1 0%; }', 'frame')).toEqual(['.frame (width)', '.frame (height)']);
    expect(holdsContentIn('.frame { flex: auto; min-width: 0px; min-height: 0px; }', 'frame')).toEqual([]);
    expect(holdsContentIn('.frame { flex: 1; overflow: hidden; }', 'frame')).toEqual([]);
    // One that doesn't grow takes its own size; a state's or a child's rule isn't the box's own.
    expect(holdsContentIn('.frame { height: 100%; } .frame[hidden] { flex: 1 } .frame > .row { flex: 1 }', 'frame')).toEqual([]);
    expect(holdsContentIn('.frame { flex: none; }', 'frame')).toEqual([]);
    expect(holdsContentIn('.frame { flex: 2 } .other { flex-grow: 1 }', 'frame')).toEqual(['.frame (width)', '.frame (height)']);
    expect(holdsContentIn('.frame { flex-grow: 1; overflow: auto }', 'frame')).toEqual([]);
    // A class always set beside another shares its rules.
    expect(holdsContentIn('.pane { min-width: 0; min-height: 0; } .rest { flex: 1; }', 'rest', 'pane')).toEqual([]);
  });
});
