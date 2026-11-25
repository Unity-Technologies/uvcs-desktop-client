/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The renderer's source folder, which the wrappers' files are relative to. */
const RENDERER = join(__dirname, '..');

/** A CSS module the boxes every view and page sit in are styled in, and the classes of those boxes. */
export interface ViewWrapperFile {
  file: string;
  classes: string[];
}

/**
 * The boxes every view and page sits in, from the window's screen down to a page's content (`PlaceLayout`,
 * `SignInCover`, `KeptView`, `PageFrame`, `SplitPane`, `Stowable`, a page window's `PageWindowScreen`), by their
 * classes. The rules on them hold for every view and page at once (`viewWrappersMakeNoStackingContext.test.ts`).
 */
export const VIEW_WRAPPERS: ViewWrapperFile[] = [
  { file: 'app/shell/PlaceLayout.module.css', classes: ['screen', 'body', 'main', 'content', 'layer'] },
  { file: 'app/signIn/SignInCover.module.css', classes: ['cover', 'covered'] },
  { file: 'app/shell/PageFrame.module.css', classes: ['frame', 'content'] },
  { file: 'ui/SplitPane.module.css', classes: ['split', 'pane', 'rest'] },
  { file: 'ui/Stowable.module.css', classes: ['stowable'] },
  { file: 'app/pageWindow/PageWindowScreen.module.css', classes: ['screen', 'content'] },
];

export interface CssRule {
  selector: string;
  declarations: string[];
}

/** A CSS file's rules as selector and declarations, `@media` blocks' included, comments left out. */
export function cssRules(text: string): CssRule[] {
  const css = text.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector.trim(),
    declarations: body.split(';').map((declaration) => declaration.trim()).filter(Boolean),
  }));
}

/** Whether a selector styles the class itself (in any of its comma-separated parts), not a child or a pseudo-element. */
export function stylesClass(selector: string, className: string): boolean {
  return selector.split(',').some((part) => new RegExp(`\\.${className}(?![\\w-])[^\\s>+~]*$`).test(part.trim()) && !part.includes('::'));
}

/** A wrapper's CSS module as it is on disk. */
export function readWrapperCss(file: string): string {
  return readFileSync(join(RENDERER, file), 'utf8');
}
