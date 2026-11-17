import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

/** The sources that render `component` (`<AttributeChipList`), by their path under the renderer, written with `/`. */
const sourcesRendering = (component: string): string[] =>
  filesUnder(__dirname, isAppSource)
    .filter((file) => new RegExp(`<${component}\\b`).test(readFileSync(file, 'utf8')))
    .map((file) => relative(__dirname, file).split('\\').join('/'))
    .sort();

/**
 * Every details panel shows an object's attributes the same way, in a titled section under its heading
 * (`AttributesDetailsSection`, docs/ARCHITECTURE.md "List and details"), never as chips in its header. Only the review
 * page's rail, which isn't a details panel, frames the same section its own way (`BranchAttributesSection`).
 */
describe('details panels', () => {
  it('show attributes only through their Attributes section', () => {
    expect(sourcesRendering('AttributeChipList')).toEqual(['features/attributes/AttributesDetailsSection.tsx', 'features/codeReviews/conversation/BranchAttributesSection.tsx']);
  });
});
