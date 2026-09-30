import { wordMatchRanges } from '../../../lib/textMatchRanges';
import type { DrawContext } from './drawContext';

/** A matched part of a drawn text: where it starts from the text's start, how wide it is, and its letters. */
interface Mark {
  left: number;
  width: number;
  text: string;
}

const NONE: readonly Mark[] = [];
const MAX_CACHED = 2000;

/** Per font, the marks of the current search in each text drawn. */
const marksByFont = new Map<string, { query: string; marks: Map<string, readonly Mark[]> }>();

/** The words of the search where `text` holds them (`wordMatchRanges`, as every list marks them), measured. */
function marksOf(ctx: CanvasRenderingContext2D, text: string, query: string): readonly Mark[] {
  const font = ctx.font;
  let bucket = marksByFont.get(font);
  if (!bucket || bucket.query !== query) marksByFont.set(font, (bucket = { query, marks: new Map() }));
  let marks = bucket.marks.get(text);
  if (marks === undefined) {
    const found = wordMatchRanges(text, query).map(([start, end]): Mark => {
      const left = ctx.measureText(text.slice(0, start)).width;
      return { left, width: ctx.measureText(text.slice(0, end)).width - left, text: text.slice(start, end) };
    });
    if (bucket.marks.size > MAX_CACHED) bucket.marks.clear();
    bucket.marks.set(text, (marks = found.length > 0 ? found : NONE));
  }
  return marks;
}

function currentMarks({ ctx, scene }: DrawContext, text: string): readonly Mark[] {
  return scene.search && scene.searchQuery ? marksOf(ctx, text, scene.searchQuery) : NONE;
}

/**
 * Marks the search words in a line of text about to be drawn at `x` (in the context's current font), the way a find
 * bar does: a patch in the search color behind the matched letters. Measured once per text, font and search.
 */
export function drawSearchMarks(draw: DrawContext, text: string, x: number, middle: number, height: number): void {
  const marks = currentMarks(draw, text);
  if (marks.length === 0) return;
  const { ctx, pen, scene } = draw;
  const fill = ctx.fillStyle;
  const alpha = ctx.globalAlpha;
  ctx.fillStyle = scene.palette.searchHit;
  ctx.globalAlpha = alpha * (scene.palette.isDark ? 0.5 : 0.45);
  ctx.beginPath();
  for (const mark of marks) pen.roundRect(x + mark.left - 1, middle - height / 2, mark.width + 2, height, 2);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.globalAlpha = alpha;
}

/** Draws the matched letters of a line just drawn at `x` again in the strongest ink, so muted text reads on its marks. */
export function redrawMarkedLetters(draw: DrawContext, text: string, x: number, y: number): void {
  const marks = currentMarks(draw, text);
  if (marks.length === 0) return;
  const { ctx, pen, scene } = draw;
  const fill = ctx.fillStyle;
  ctx.fillStyle = scene.palette.textPrimary;
  for (const mark of marks) pen.fillText(mark.text, x + mark.left, y);
  ctx.fillStyle = fill;
}
