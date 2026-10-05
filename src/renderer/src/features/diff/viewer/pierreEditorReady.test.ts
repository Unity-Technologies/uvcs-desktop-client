import { FileDiff, type DiffHunksRenderer } from '@pierre/diffs';
import { describe, expect, it } from 'vitest';
import { lineDiff } from './lineDiff';
import { isReadyToEdit } from './pierreEditorReady';

const diffOf = (modified: string) => lineDiff('const a = 1;\nconst b = 2;\n', modified, 'recognizeAll', 'file.ts').meta;

/** A diff component whose renderer rendered `diff` highlighted, as Pierre's workers hand it back. */
async function rendered(diff: ReturnType<typeof diffOf>, useTokenTransformer: boolean) {
  const component = new FileDiff({ theme: 'github-light', useTokenTransformer });
  const renderer = (component as unknown as { hunksRenderer: DiffHunksRenderer }).hunksRenderer;
  await renderer.asyncRender(diff);
  renderer.renderDiff(diff);
  return component;
}

describe('isReadyToEdit', () => {
  it("is ready once the diff shown is highlighted in the editor's markup", async () => {
    const diff = diffOf('const a = 1;\nconst b = 3;\n');
    expect(isReadyToEdit(await rendered(diff, true), diff)).toBe(true);
  });

  it("isn't before it's highlighted in that markup", async () => {
    const diff = diffOf('const a = 1;\nconst b = 3;\n');
    expect(isReadyToEdit(await rendered(diff, false), diff)).toBe(false);
    expect(isReadyToEdit(new FileDiff({ theme: 'github-light', useTokenTransformer: true }), diff)).toBe(false);
  });

  it("isn't for a diff other than the one highlighted", async () => {
    const shown = diffOf('const a = 1;\nconst b = 3;\n');
    expect(isReadyToEdit(await rendered(shown, true), diffOf('const a = 1;\nconst b = 4;\n'))).toBe(false);
  });
});
