import { DiffHunksRenderer } from '@pierre/diffs';
import { beforeAll, describe, expect, it } from 'vitest';
import { SNIPPET_FOLDS_OVER } from '../../diff/viewer/pierreOptions';
import { warmUpPierre } from '../../diff/viewer/pierreSessionFixture';
import { wordMarksIn, type RenderedNode, type WordMarks } from '../../diff/viewer/renderedWordMarks';
import { suggestionFileDiff } from './suggestionFileDiff';
import type { SuggestionView } from './suggestionViewStore';

// The box's diff is one hunk of the commented lines numbered from the first (`suggestionLineDiff`, `replacedThenSuggested`), which Pierre
// never builds itself: its own hunks index their lines from where they start in a whole file. These render it as the
// box does, so a Pierre that read the lines or numbered the rows another way fails here, not on screen.
beforeAll(warmUpPierre);

interface Rendered {
  /** Each row, top to bottom: its line number, `-` removed or `+` added, and its text. */
  rows: string[];
  marks: WordMarks;
}

async function rendered(replacedText: string, suggestedText: string, firstLine: number, view: SuggestionView = 'diff'): Promise<Rendered> {
  // Folding as the box does (`pierreSnippetDiffOptions`): only a run of more than `SNIPPET_FOLDS_OVER` unchanged lines.
  const renderer = new DiffHunksRenderer({ theme: 'pierre-light', diffStyle: 'unified', lineDiffType: 'word', expandUnchanged: false, collapsedContextThreshold: SNIPPET_FOLDS_OVER });
  const result = await renderer.asyncRender(suggestionFileDiff('a.cs', { replacedText, suggestedText, firstLine }, view));
  const rowNodes = (renderer.renderCodeAST('unified', result) ?? []).flatMap(rowNodesIn);
  const marksOf = (lineType: string) => wordMarksIn(rowNodes.filter((row) => row.type === 'element' && row.properties?.['data-line-type'] === lineType));
  return { rows: rowNodes.map(rowText), marks: { deletions: marksOf('change-deletion'), additions: marksOf('change-addition') } };
}

/** The code's rows (`data-line`) under a node: the gutter's rows hold only their numbers. */
function rowNodesIn(node: RenderedNode): RenderedNode[] {
  if (node.type !== 'element') return [];
  return node.properties?.['data-line'] === undefined ? node.children.flatMap(rowNodesIn) : [node];
}

function rowText(row: RenderedNode): string {
  if (row.type !== 'element') return '';
  const lineType = row.properties?.['data-line-type'];
  const sign = lineType === 'change-deletion' ? '-' : lineType === 'change-addition' ? '+' : ' ';
  return `${String(row.properties?.['data-line'])} ${sign} ${textOf(row)}`;
}

function textOf(node: RenderedNode): string {
  if (node.type === 'text') return node.value.replace(/\n$/, '');
  return node.type === 'element' ? node.children.map(textOf).join('') : '';
}

describe('a suggested change as Pierre draws it, as a diff', () => {
  it('draws a line wrapped in a new condition as the code diff does, numbered from it, and nothing else', async () => {
    const { rows } = await rendered('    run();\n', '    if (ok)\n        run();\n', 273);
    expect(rows).toEqual(['273 +     if (ok)', '273 -     run();', '274 +         run();']);
  });

  it('draws the lines a rewrite keeps once, untinted, and marks the words of the lines edited though it adds others', async () => {
    const { rows, marks } = await rendered('{\n    var s = A();\n    Undo();\n}\n', '{\n    Shelve s = A();\n    Undo(B);\n    Log();\n}\n', 9);
    expect(rows).toEqual(['9   {', '10 -     var s = A();', '11 -     Undo();', '10 +     Shelve s = A();', '11 +     Undo(B);', '12 +     Log();', '13   }']);
    expect(marks).toEqual({ deletions: ['var'], additions: ['Shelve', 'B'] });
  });

  it('draws a deletion as the lines removed alone', async () => {
    expect((await rendered('old();\nolder();\n', '', 40)).rows).toEqual(['40 - old();', '41 - older();']);
  });

  it('draws the suggested lines alone when the replaced ones are unknown', async () => {
    expect((await rendered('', 'new();\n', 3)).rows).toEqual(['3 + new();']);
  });

  it('numbers a suggestion on the first line from 1', async () => {
    expect((await rendered('a = 1;\n', 'a = 2;\n', 1)).rows).toEqual(['1 - a = 1;', '1 + a = 2;']);
  });

  it('marks the changed words of a range edited line by line', async () => {
    const { rows, marks } = await rendered('a = 1;\nkeep();\nb = 2;\n', 'a = 2;\nkeep();\nb = 3;\n', 10);
    expect(rows).toEqual(['10 - a = 1;', '10 + a = 2;', '11   keep();', '12 - b = 2;', '12 + b = 3;']);
    expect(marks).toEqual({ deletions: ['1', '2'], additions: ['2', '3'] });
  });

  const method = (length: number, edited: (line: number) => boolean) =>
    Array.from({ length }, (_, index) => (edited(index + 1) ? `edited${index + 1}();` : `line${index + 1}();`)).join('\n') + '\n';
  const lineNumbers = (rows: string[]) => rows.map((row) => Number(row.split(' ')[0]));

  it('folds a long run of lines kept between two changes, keeping three lines around each', async () => {
    const { rows } = await rendered(method(50, () => false), method(50, (line) => line === 2 || line === 49), 101);
    expect(lineNumbers(rows)).toEqual([101, 102, 102, 103, 104, 105, 146, 147, 148, 149, 149, 150]);
  });

  it('folds a long run of lines kept before or after the only change, numbered as the file', async () => {
    expect(lineNumbers((await rendered(method(30, () => false), method(30, (line) => line === 30), 11)).rows)).toEqual([37, 38, 39, 40, 40]);
    expect(lineNumbers((await rendered(method(30, () => false), method(30, (line) => line === 1), 11)).rows)).toEqual([11, 11, 12, 13, 14]);
  });

  it(`shows a run of up to ${SNIPPET_FOLDS_OVER} lines it would fold whole`, async () => {
    const between = 2 * 3 + SNIPPET_FOLDS_OVER;
    const { rows } = await rendered(method(between + 2, () => false), method(between + 2, (line) => line === 1 || line === between + 2), 1);
    expect(rows).toHaveLength(between + 4);
  });
});

describe('a suggested change as Pierre draws it, stacked', () => {
  it('draws a line wrapped in a new condition as the line replaced, then the lines suggested', async () => {
    const { rows, marks } = await rendered('    run();\n', '    if (ok)\n        run();\n', 273, 'stacked');
    expect(rows).toEqual(['273 -     run();', '273 +     if (ok)', '274 +         run();']);
    expect(marks).toEqual({ deletions: [], additions: [] });
  });

  it("draws no word marks of Pierre's on a range edited line by line: they're drawn over the rows (`stackedWordMarks`)", async () => {
    const { rows, marks } = await rendered('a = 1;\nkeep();\nb = 2;\n', 'a = 2;\nkeep();\nb = 3;\n', 10, 'stacked');
    expect(rows).toEqual(['10 - a = 1;', '11 - keep();', '12 - b = 2;', '10 + a = 2;', '11 + keep();', '12 + b = 3;']);
    expect(marks).toEqual({ deletions: [], additions: [] });
  });

  it("marks no words in a range whose lines don't take the replaced ones' places one for one", async () => {
    const { marks } = await rendered('x = 1;\ny = 2;\n', 'if (ok)\n    x = 1;\ny = 3;\n', 10, 'stacked');
    expect(marks).toEqual({ deletions: [], additions: [] });
  });
});
