import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

/** The sources that render the bare chips (`<AttributeChips`), by their path under the renderer, written with `/`. */
const rendersBareChips = filesUnder(__dirname, isAppSource)
  .filter((file) => /<AttributeChips\b/.test(readFileSync(file, 'utf8')))
  .map((file) => relative(__dirname, file).split('\\').join('/'))
  .sort();

/**
 * Every details panel shows an object's attributes the same way, in a titled section under its heading
 * (`AttributesDetailsSection`, docs/ARCHITECTURE.md "List and details"), never as chips in its header. Only the review
 * page's rail, which isn't a details panel, shows the bare chips.
 */
describe('details panels', () => {
  it('show attributes only through their Attributes section', () => {
    expect(rendersBareChips).toEqual(['features/codeReviews/conversation/BranchAttributesSection.tsx']);
  });
});
