import type { DiffHunksRenderer, HunksRenderResult } from '@pierre/diffs';

/** A row Pierre renders, or a node in it. */
export type RenderedNode = NonNullable<ReturnType<DiffHunksRenderer['renderCodeAST']>>[number];

/** The text of each word marked as changed in the rows of each side, in order. */
export interface WordMarks {
  deletions: string[];
  additions: string[];
}

/** For tests: the words Pierre marks as changed (its `data-diff-span`) in the rows it rendered. */
export function renderedWordMarks(renderer: DiffHunksRenderer, result: HunksRenderResult): WordMarks {
  return { deletions: wordMarksIn(renderer.renderCodeAST('deletions', result)), additions: wordMarksIn(renderer.renderCodeAST('additions', result)) };
}

/** For tests: the words marked as changed in rendered rows (or lines), in order. */
export function wordMarksIn(nodes: RenderedNode[] | undefined): string[] {
  const marks: string[] = [];
  const visit = (node: RenderedNode): void => {
    if (node.type !== 'element') return;
    if (node.properties?.['data-diff-span'] !== undefined) marks.push(textOf(node));
    else node.children.forEach(visit);
  };
  nodes?.forEach(visit);
  return marks;
}

function textOf(node: RenderedNode): string {
  if (node.type === 'text') return node.value;
  return node.type === 'element' ? node.children.map(textOf).join('') : '';
}
