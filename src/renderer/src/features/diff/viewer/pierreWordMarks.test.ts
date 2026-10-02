import { DiffHunksRenderer } from '@pierre/diffs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_WORD_DIFFED_LINE_PAIRS } from './changedLinePairs';
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

/** A file of `count` lines of code, about 50 bytes each. */
const code = (count: number, line: (index: number) => string = (index) => `const value${index} = compute(${index}, 'name ${index}');`) =>
  Array.from({ length: count }, (_, index) => `${line(index)}\n`).join('');

/** Counts how often Pierre highlights a whole diff, the work a refresh of the marks must not do. */
function countHighlights() {
  return vi.spyOn(DiffHunksRenderer.prototype as unknown as { renderDiffWithHighlighter: () => unknown }, 'renderDiffWithHighlighter');
}

afterEach(() => vi.restoreAllMocks());

describe('refreshWordMarks', () => {
  it('marks the words of the lines typed into on both sides, as a diff of the text typed would', async () => {
    const session = await typedIntoPierre(ORIGINAL, MODIFIED, 'recognizeAll');
    session.type(1, 'Codice.CM.Common;');
    session.type(0, 'namespace Codice.Server;');
    const typed = 'namespace Codice.Server;\nCodice.CM.Common;\nclass Main {}\n';
    // Pierre rebuilds only the rows typed into, from the editor's tokens, and keeps the other side's marks as they were.
    expect(session.wordMarks()).not.toEqual(await freshWordMarks(ORIGINAL, typed));

    expect(refreshWordMarks(session.component)).toBe(true);

    expect(session.wordMarks()).toEqual(await freshWordMarks(ORIGINAL, typed));
    expect(session.rowsInStep()).toBe(true);
  });

  it('marks a big file with a few lines typed into without highlighting it again', async () => {
    const original = code(1_200);
    expect(original.length).toBeGreaterThan(50_000);
    const lines = original.split('\n');
    lines[600] = "const value600 = compute(600, 'renamed 600');";
    const modified = lines.join('\n');
    const session = await typedIntoPierre(original, modified, 'recognizeAll');
    session.type(300, "const total300 = compute(300, 'name 300');");
    lines[300] = "const total300 = compute(300, 'name 300');";
    const highlights = countHighlights();

    expect(refreshWordMarks(session.component)).toBe(true);

    expect(highlights).not.toHaveBeenCalled();
    highlights.mockRestore();
    expect(session.wordMarks()).toEqual(await freshWordMarks(original, lines.join('\n')));
  });

  it('drops the marks of a line typed back to the original', async () => {
    const session = await typedIntoPierre(ORIGINAL, ORIGINAL.replace('namespace Codice;', 'namespace Plastic;'), 'recognizeAll');
    expect(session.wordMarks()).toEqual({ deletions: ['Codice'], additions: ['Plastic'] });
    session.type(0, 'namespace Codice;');
    expect(refreshWordMarks(session.component)).toBe(true);
    expect(session.wordMarks()).toEqual({ deletions: [], additions: [] });
  });

  it('leaves the marks to the save once more lines changed than are worth diffing', async () => {
    const original = code(MAX_WORD_DIFFED_LINE_PAIRS + 1);
    const modified = code(MAX_WORD_DIFFED_LINE_PAIRS + 1, (index) => `let value${index} = compute(${index}, 'name ${index}');`);
    const session = await typedIntoPierre(original, modified, 'recognizeAll');
    session.type(0, 'var value0;');
    const before = session.wordMarks();
    expect(refreshWordMarks(session.component)).toBe(false);
    expect(session.wordMarks()).toEqual(before);
  });
});
