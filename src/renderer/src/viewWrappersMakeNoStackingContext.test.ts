import { describe, expect, it } from 'vitest';
import { cssRules, readWrapperCss, stylesClass, VIEW_WRAPPERS, type ViewWrapperFile } from './testing/viewWrappers';

/**
 * What makes a stacking context, which keeps a fixed overlay inside it under what the page's body draws, or a frame
 * for fixed boxes, which shrinks and clips the overlay into the wrapper. The views' entrance animation (`view-enter`,
 * an opacity and a transform) is left out: it ends in a moment and keeps nothing.
 */
const TRAPS: RegExp[] = [
  /^isolation:\s*isolate/,
  /^z-index:\s*(?!\s|auto\b)/,
  /^opacity:\s*(?!\s|1(\.0*)?\s*$|100(\.0*)?%)/,
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

/** What in a CSS file's rules for the wrapper classes makes a stacking context, as `selector { declaration }`. */
function trapsInCss(css: string, classes: string[], allowedSelectors: string[] = []): string[] {
  return cssRules(css)
    .filter((rule) => classes.some((className) => stylesClass(rule.selector, className)))
    .filter((rule) => !allowedSelectors.includes(rule.selector))
    .flatMap((rule) => rule.declarations.filter((declaration) => TRAPS.some((trap) => trap.test(declaration))).map((declaration) => `${rule.selector} { ${declaration} }`));
}

function trapsIn({ file, classes }: ViewWrapperFile): string[] {
  const allowed = ALLOWED.filter((rule) => rule.file === file).map((rule) => rule.selector);
  return trapsInCss(readWrapperCss(file), classes, allowed).map((trap) => `${file} ${trap}`);
}

describe('the boxes the views sit in', () => {
  // `isolation: isolate` on `SignInCover`'s `.covered` once put every larger comment editor outside a dialog under its
  // own backdrop, out of reach: the panel's z-index counted only inside the wrapper.
  it('make no stacking context and no frame for fixed boxes, so a view’s overlay lies over the whole window', () => {
    expect(VIEW_WRAPPERS.flatMap(trapsIn)).toEqual([]);
  });

  it('are all still where the rule looks for them: each class is styled in its file', () => {
    const missing = VIEW_WRAPPERS.flatMap(({ file, classes }) => {
      const rules = cssRules(readWrapperCss(file));
      return classes.filter((className) => !rules.some((rule) => stylesClass(rule.selector, className))).map((className) => `${file} .${className}`);
    });
    expect(missing).toEqual([]);
  });

  it('reads what makes a stacking context as CSS writes it', () => {
    const found = (css: string) => trapsInCss(css, ['content']);
    expect(found('.content { isolation: isolate; }')).toEqual(['.content { isolation: isolate }']);
    expect(found('@media (x) { .content[data-a] { z-index: 2 } }')).toEqual(['.content[data-a] { z-index: 2 }']);
    expect(found('.content { opacity: 0.5; transform: translateX(-50%); }')).toEqual(['.content { opacity: 0.5 }', '.content { transform: translateX(-50%) }']);
    // Not the wrapper itself: a child, a pseudo-element, or nothing that traps.
    expect(found('.content > .row { z-index: 1 } .content::after { z-index: 1 } .contentArea { z-index: 1 }')).toEqual([]);
    expect(found('.content { opacity: 0 } .content[a] { opacity: 50% }')).toEqual(['.content { opacity: 0 }', '.content[a] { opacity: 50% }']);
    expect(found('.content { z-index: auto; opacity: 1; transform: none; position: relative } .content[b] { opacity: 100% }')).toEqual([]);
    expect(trapsInCss('.content[inert] { isolation: isolate }', ['content'], ['.content[inert]'])).toEqual([]);
  });
});
