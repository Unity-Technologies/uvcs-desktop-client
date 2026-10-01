import { describe, expect, it } from 'vitest';
import { fitBranchName } from './fitText';

/** A context whose every character is 1px wide, in a font of its own so the cache never answers for another test. */
function context(font: string): CanvasRenderingContext2D {
  return { font, measureText: (text: string) => ({ width: Array.from(text).length }) } as unknown as CanvasRenderingContext2D;
}

describe('fitBranchName', () => {
  it('keeps a name that fits whole', () => {
    expect(fitBranchName(context('fits'), '/main/task', 20)).toBe('/main/task');
  });

  it('drops parent branches from the middle so the leaf stays whole', () => {
    expect(fitBranchName(context('parents'), '/main/child-br-cr-sample/empty-branch2/child_1/subtask', 24)).toBe('/main/…/child_1/subtask');
  });

  it('cuts a leaf too wide on its own in its middle, after a hint that it has parents', () => {
    const fitted = fitBranchName(context('leaf'), '/main/rendering-pipeline-integration-with-asset-bundles', 24);
    expect(fitted).toBe('…/rendering-p…et-bundles');
  });
});
