/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RENDERER = __dirname;

/**
 * The boxes every view and page sits in, from the window's screen down to a page's content (`PlaceLayout`,
 * `SignInCover`, `KeptView`, `PageFrame`, `SplitPane`, `Stowable`, a page window's `PageWindowScreen`), by their
 * classes. A view's overlay drawn in the page (a comment's larger editor, `CommentFocusGroup`) lies over the window
 * only while none of them makes a stacking context or holds fixed boxes as their frame.
 */
const VIEW_WRAPPERS: { file: string; classes: string[] }[] = [
  { file: 'app/shell/PlaceLayout.module.css', classes: ['screen', 'body', 'main', 'content', 'layer'] },
  { file: 'app/signIn/SignInCover.module.css', classes: ['cover', 'covered'] },
  { file: 'app/shell/PageFrame.module.css', classes: ['frame', 'content'] },
  { file: 'ui/SplitPane.module.css', classes: ['split', 'pane', 'rest'] },
  { file: 'ui/Stowable.module.css', classes: ['stowable'] },
  { file: 'app/pageWindow/PageWindowScreen.module.css', classes: ['screen', 'content'] },
];

/**
 * What makes a stacking context, which keeps a fixed overlay inside it under what the page's body draws, or a frame
 * for fixed boxes, which shrinks and clips the overlay into the wrapper. The views' entrance animation (`view-enter`,
 * an opacity and a transform) is left out: it ends in a moment and keeps nothing.
 */
const TRAPS: RegExp[] = [
  /^isolation:\s*isolate/,
  /^z-index:\s*(?!\s|auto\b)/,
  /^opacity:\s*0?\.\d/,
  /^(transform|filter|backdrop-filter|perspective|clip-path|mask(-image)?):\s*(?!\s|none\b)/,
  /^mix-blend-mode:\s*(?!\s|normal\b)/,
  /^contain:\s*.*\b(layout|paint|strict|content)\b/,
  /^container-type:\s*(size|inline-size)/,
  /^will-change:\s*.*\b(transform|opacity|filter|perspective)\b/,
];

/**
 * Where a wrapper may make one, and why: covered by the sign-in screen, its views draw their layers (a model viewer's
 * labels) within it, under the screen, and nothing in them can be used meanwhile (`inert`).
 */
const ALLOWED: { file: string; selector: string }[] = [{ file: 'app/signIn/SignInCover.module.css', selector: '.covered[inert]' }];

/** A CSS file's rules as selector and declarations, `@media` blocks' included, comments left out. */
function cssRules(text: string): { selector: string; declarations: string[] }[] {
  const css = text.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector.trim(),
    declarations: body.split(';').map((declaration) => declaration.trim()).filter(Boolean),
  }));
}

/** Whether a selector styles the class itself (in any of its comma-separated parts), not a child or a pseudo-element. */
function stylesClass(selector: string, className: string): boolean {
  return selector.split(',').some((part) => new RegExp(`\\.${className}(?![\\w-])[^\\s>+~]*$`).test(part.trim()) && !part.includes('::'));
}

function trapsIn({ file, classes }: { file: string; classes: string[] }): string[] {
  return cssRules(readFileSync(join(RENDERER, file), 'utf8'))
    .filter((rule) => classes.some((className) => stylesClass(rule.selector, className)))
    .filter((rule) => !ALLOWED.some((allowed) => allowed.file === file && allowed.selector === rule.selector))
    .flatMap((rule) => rule.declarations.filter((declaration) => TRAPS.some((trap) => trap.test(declaration))).map((declaration) => `${file} ${rule.selector} { ${declaration} }`));
}

describe('the boxes the views sit in', () => {
  // `isolation: isolate` on `SignInCover`'s `.covered` once put every larger comment editor outside a dialog under its
  // own backdrop, out of reach: the panel's z-index counted only inside the wrapper.
  it('make no stacking context and no frame for fixed boxes, so a view’s overlay lies over the whole window', () => {
    expect(VIEW_WRAPPERS.flatMap(trapsIn)).toEqual([]);
  });

  it('are all still where the rule looks for them: each class is styled in its file', () => {
    const missing = VIEW_WRAPPERS.flatMap(({ file, classes }) => {
      const rules = cssRules(readFileSync(join(RENDERER, file), 'utf8'));
      return classes.filter((className) => !rules.some((rule) => stylesClass(rule.selector, className))).map((className) => `${file} .${className}`);
    });
    expect(missing).toEqual([]);
  });

  it('reads what makes a stacking context as CSS writes it', () => {
    const wrapper = { file: 'app/shell/PlaceLayout.module.css', classes: ['content'] };
    const found = (css: string) =>
      cssRules(css)
        .filter((rule) => wrapper.classes.some((className) => stylesClass(rule.selector, className)))
        .flatMap((rule) => rule.declarations.filter((declaration) => TRAPS.some((trap) => trap.test(declaration))));
    expect(found('.content { isolation: isolate; }')).toEqual(['isolation: isolate']);
    expect(found('@media (x) { .content[data-a] { z-index: 2 } }')).toEqual(['z-index: 2']);
    expect(found('.content { opacity: 0.5; transform: translateX(-50%); }')).toEqual(['opacity: 0.5', 'transform: translateX(-50%)']);
    // Not the wrapper itself: a child, a pseudo-element, or nothing that traps.
    expect(found('.content > .row { z-index: 1 } .content::after { z-index: 1 } .contentArea { z-index: 1 }')).toEqual([]);
    expect(found('.content { z-index: auto; opacity: 1; transform: none; position: relative }')).toEqual([]);
  });
});
