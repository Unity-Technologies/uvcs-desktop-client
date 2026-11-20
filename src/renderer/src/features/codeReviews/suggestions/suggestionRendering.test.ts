import { DiffHunksRenderer } from '@pierre/diffs';
import { beforeAll, describe, expect, it } from 'vitest';
import { warmUpPierre } from '../../diff/viewer/pierreSessionFixture';
import { wordMarksIn, type RenderedNode, type WordMarks } from '../../diff/viewer/renderedWordMarks';
import { suggestionFileDiff } from './suggestionFileDiff';

// The box's diff is one hunk of the commented lines numbered from the first (`suggestionLineDiff`), which Pierre
// never builds itself: its own hunks index their lines from where they start in a whole file. These render it as the
// box does, so a Pierre that read the lines or numbered the rows another way fails here, not on screen.
beforeAll(warmUpPierre);

interface Rendered {
  /** Each row, top to bottom: its line number, `-` removed or `+` added, and its text. */
  rows: string[];
  marks: WordMarks;
}

async function rendered(replacedText: string, suggestedText: string, firstLine: number): Promise<Rendered> {
  const renderer = new DiffHunksRenderer({ theme: 'pierre-light', diffStyle: 'unified', lineDiffType: 'word', expandUnchanged: true });
  const result = await renderer.asyncRender(suggestionFileDiff('a.cs', { replacedText, suggestedText, firstLine }));
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

describe('a suggested change as Pierre draws it', () => {
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

});
