import { cleanLastNewline, pushOrJoinSpan, type LineDiffTypes } from '@pierre/diffs';
import { diffChars, diffWordsWithSpace, type ChangeObject } from 'diff';
import type { RenderedNode } from './renderedWordMarks';

/** A row of a diff as Pierre renders it and keeps it (`renderCache.result.code`): a line's tokens in a `div`. */
export type RenderedRow = Extract<RenderedNode, { type: 'element' }>;

/** Characters of a line marked as changed: `start` to `end`, not included. */
export interface MarkRange {
  start: number;
  end: number;
}

/** The marks of a pair of lines, the line removed and the line that replaces it. */
export interface LineWordMarks {
  deletion: MarkRange[];
  addition: MarkRange[];
}

const DIFF_SPAN = 'data-diff-span';
const TOKEN_CHAR = 'data-char';

/**
 * The words two lines change, marked as Pierre (1.5.1) marks them when it renders a diff
 * (`computeLineDiffDecorations` in `renderDiffWithHighlighter`): the same line diff (`diffWordsWithSpace`, or
 * `diffChars` for "char"), its spans joined as Pierre joins them (`pushOrJoinSpan`), nothing on lines longer than
 * `maxLineDiffLength`.
 */
export function lineWordMarks(deletionLine: string, additionLine: string, lineDiffType: LineDiffTypes, maxLineDiffLength: number): LineWordMarks {
  const removed = cleanLastNewline(deletionLine);
  const added = cleanLastNewline(additionLine);
  if (lineDiffType === 'none' || removed.length > maxLineDiffLength || added.length > maxLineDiffLength) return { deletion: [], addition: [] };
  const changes = lineDiffType === 'char' ? diffChars(removed, added) : diffWordsWithSpace(removed, added);
  if (lineDiffType === 'word-line') return wholeChangeMarks(changes);
  const enableJoin = lineDiffType === 'word-alt';
  const deletionSpans: [0 | 1, string][] = [];
  const additionSpans: [0 | 1, string][] = [];
  const last = changes.at(-1);
  for (const item of changes) {
    const isLastItem = item === last;
    if (!item.added && !item.removed) {
      pushOrJoinSpan({ item, arr: deletionSpans, enableJoin, isNeutral: true, isLastItem });
      pushOrJoinSpan({ item, arr: additionSpans, enableJoin, isNeutral: true, isLastItem });
    } else {
      pushOrJoinSpan({ item, arr: item.removed ? deletionSpans : additionSpans, enableJoin, isLastItem });
    }
  }
  return { deletion: markedSpans(deletionSpans), addition: markedSpans(additionSpans) };
}

function markedSpans(spans: [0 | 1, string][]): MarkRange[] {
  const marks: MarkRange[] = [];
  let offset = 0;
  for (const [marked, text] of spans) {
    if (marked === 1) marks.push({ start: offset, end: offset + text.length });
    offset += text.length;
  }
  return marks;
}

/** "word-line": one mark on each side, from the first change to the last (`pushWordLineDecorations`). */
function wholeChangeMarks(changes: ChangeObject<string>[]): LineWordMarks {
  const deletion = { start: -1, end: 0 };
  const addition = { start: -1, end: 0 };
  let deletionOffset = 0;
  let additionOffset = 0;
  for (const { value, added, removed } of changes) {
    if (removed) {
      if (deletion.start === -1) deletion.start = deletionOffset;
      deletionOffset += value.length;
      deletion.end = deletionOffset;
    } else if (added) {
      if (addition.start === -1) addition.start = additionOffset;
      additionOffset += value.length;
      addition.end = additionOffset;
    } else {
      deletionOffset += value.length;
      additionOffset += value.length;
    }
  }
  return { deletion: deletion.start === -1 ? [] : [deletion], addition: addition.start === -1 ? [] : [addition] };
}

/** A run of a row's text: its color (`style`) and the token it belongs to (`data-char`, where the token starts). */
interface TextRun {
  text: string;
  style: string | undefined;
  token: number | undefined;
}

/** The row's text in runs, in order, without the marks it had. */
function textRuns(node: RenderedNode, style: string | undefined, token: number | undefined, runs: TextRun[]): TextRun[] {
  if (node.type === 'text') {
    const previous = runs.at(-1);
    if (previous && previous.style === style && previous.token === token) previous.text += node.value;
    else runs.push({ text: node.value, style, token });
  } else if (node.type === 'element') {
    const ownStyle = node.properties?.style;
    const ownToken = node.properties?.[TOKEN_CHAR];
    for (const child of node.children) {
      textRuns(child, typeof ownStyle === 'string' ? ownStyle : style, ownToken === undefined ? token : Number(ownToken), runs);
    }
  }
  return runs;
}

/** The characters a row shows marked, in order, marks that touch read as one. */
export function rowWordMarks(row: RenderedRow): MarkRange[] {
  const marks: MarkRange[] = [];
  let offset = 0;
  const visit = (node: RenderedNode, marked: boolean): void => {
    if (node.type === 'text') {
      if (marked && node.value.length > 0) addMark(marks, { start: offset, end: offset + node.value.length });
      offset += node.value.length;
    } else if (node.type === 'element') {
      for (const child of node.children) visit(child, marked || node.properties?.[DIFF_SPAN] !== undefined);
    }
  };
  for (const child of row.children) visit(child, false);
  return marks;
}

/** The characters marks cover, in order, marks that touch read as one: what a row shows of them (`rowWordMarks`). */
export function coveredMarks(marks: readonly MarkRange[]): MarkRange[] {
  const covered: MarkRange[] = [];
  for (const mark of marks) if (mark.end > mark.start) addMark(covered, { ...mark });
  return covered;
}

function addMark(marks: MarkRange[], mark: MarkRange): void {
  const previous = marks.at(-1);
  if (previous && previous.end >= mark.start) previous.end = Math.max(previous.end, mark.end);
  else marks.push(mark);
}

/**
 * The row with its text marked at `marks`, in place of the marks it had, in the shapes Pierre renders marks in with
 * the editor's token markup (`useTokenTransformer`): tokens marked whole go inside one mark (`data-diff-span`), a token
 * marked in part keeps its `data-char` and holds its marked parts, so the editor reads each token where it starts.
 * A row with no text (an empty line's `br`) stays as it is.
 */
export function markedRow(row: RenderedRow, marks: readonly MarkRange[]): RenderedRow {
  const runs = row.children.reduce<TextRun[]>((all, child) => textRuns(child, undefined, undefined, all), []);
  if (runs.length === 0) return row;
  const children: RenderedNode[] = [];
  let group: RenderedNode[] = [];
  const closeGroup = (): void => {
    if (group.length > 0) children.push(element({ [DIFF_SPAN]: '' }, group));
    group = [];
  };
  let offset = 0;
  for (const token of tokensOf(runs)) {
    const pieces = token.runs.flatMap((run) => {
      const split = splitRun(run, offset, marks);
      offset += run.text.length;
      return split;
    });
    if (pieces.every((piece) => piece.marked === pieces[0]!.marked)) {
      const node = wholeToken(token.token, pieces);
      if (pieces[0]!.marked) group.push(...node);
      else {
        closeGroup();
        children.push(...node);
      }
      continue;
    }
    closeGroup();
    const parts = pieces.map((piece) => (piece.marked ? element({ [DIFF_SPAN]: '' }, [runNode(piece)]) : runNode(piece)));
    if (token.token === undefined) children.push(...parts);
    else children.push(element({ [TOKEN_CHAR]: token.token }, parts));
  }
  closeGroup();
  return { ...row, children };
}

/** The row's runs grouped by token; runs outside any token (plain text) each a token of their own. */
function tokensOf(runs: TextRun[]): { token: number | undefined; runs: TextRun[] }[] {
  const tokens: { token: number | undefined; runs: TextRun[] }[] = [];
  for (const run of runs) {
    const last = tokens.at(-1);
    if (last && run.token !== undefined && last.token === run.token) last.runs.push(run);
    else tokens.push({ token: run.token, runs: [run] });
  }
  return tokens;
}

interface Piece extends TextRun {
  marked: boolean;
}

/** The run cut where marks start and end; `offset` is where it starts in the line. */
function splitRun(run: TextRun, offset: number, marks: readonly MarkRange[]): Piece[] {
  const end = offset + run.text.length;
  const cuts = new Set([offset, end]);
  for (const mark of marks) {
    if (mark.start > offset && mark.start < end) cuts.add(mark.start);
    if (mark.end > offset && mark.end < end) cuts.add(mark.end);
  }
  const at = [...cuts].sort((left, right) => left - right);
  return at.slice(0, -1).map((start, index) => ({
    ...run,
    text: run.text.slice(start - offset, at[index + 1]! - offset),
    marked: marks.some((mark) => mark.start <= start && start < mark.end),
  }));
}

/** A token marked whole or not at all: one span with its color, or its colored parts in one. */
function wholeToken(token: number | undefined, pieces: Piece[]): RenderedNode[] {
  if (token === undefined) return pieces.map(runNode);
  if (pieces.length === 1) return [element({ ...styleOf(pieces[0]!), [TOKEN_CHAR]: token }, [{ type: 'text', value: pieces[0]!.text }])];
  return [element({ [TOKEN_CHAR]: token }, pieces.map(runNode))];
}

function runNode(run: TextRun): RenderedNode {
  const value: RenderedNode = { type: 'text', value: run.text };
  return run.style === undefined ? value : element(styleOf(run), [value]);
}

const styleOf = (run: TextRun): Record<string, string> => (run.style === undefined ? {} : { style: run.style });

function element(properties: Record<string, string | number>, children: RenderedNode[]): RenderedRow {
  return { type: 'element', tagName: 'span', properties, children };
}
