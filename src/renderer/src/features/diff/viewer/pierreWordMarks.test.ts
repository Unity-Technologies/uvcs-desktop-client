import { DiffHunksRenderer } from '@pierre/diffs';
import { describe, expect, it } from 'vitest';
import { lineDiff } from './lineDiff';
import { typedIntoPierre } from './pierreSessionFixture';
import { refreshWordMarks } from './pierreWordMarks';
import { renderedWordMarks } from './renderedWordMarks';

const ORIGINAL = 'namespace Codice;\nusing Codice.CM.Common;\nclass Main {}\n';
const MODIFIED = 'namespace Codice.Client;\nusing Codice.CM.Common;\nclass Main {}\n';

/** The words a diff of these texts marks as changed, rendered from scratch. */
async function freshWordMarks(original: string, modified: string) {
  const diff = lineDiff(original, modified, 'recognizeAll', 'file.ts').meta;
  const renderer = new DiffHunksRenderer({ theme: 'github-light', lineDiffType: 'word', useTokenTransformer: true });
  return renderedWordMarks(renderer, await renderer.asyncRender(diff));
}

describe('refreshWordMarks', () => {
  it('marks the words of the lines typed into on both sides, as a diff of the text typed would', async () => {
    const session = await typedIntoPierre(ORIGINAL, MODIFIED, 'recognizeAll');
    session.type(1, 'Codice.CM.Common;');
    session.type(0, 'namespace Codice.Server;');
    const typed = 'namespace Codice.Server;\nCodice.CM.Common;\nclass Main {}\n';
    // Pierre rebuilds only the rows typed into, from the editor's tokens, and keeps the other side's marks as they were.
    expect(session.wordMarks()).not.toEqual(await freshWordMarks(ORIGINAL, typed));

    refreshWordMarks(session.component);

    expect(session.wordMarks()).toEqual(await freshWordMarks(ORIGINAL, typed));
    expect(session.rowsInStep()).toBe(true);
    // Highlighted with the editor's token markup (`useTokenTransformer`), which it maps the caret through.
    expect((session.component as unknown as { hunksRenderer: DiffHunksRenderer }).hunksRenderer.editorRenderReady()).toBe(true);
  });
});
