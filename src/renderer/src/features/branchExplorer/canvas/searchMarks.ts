import type { DrawContext } from './drawContext';

/** The words of a search, lowercased: each one is marked wherever it shows. */
export function searchTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Where the terms occur in `text`, ignoring case, as merged [start, end) character pairs, in order. */
export function matchRanges(text: string, terms: readonly string[]): number[] {
  const lower = text.toLowerCase();
  const found: [number, number][] = [];
  for (const term of terms) {
    for (let at = lower.indexOf(term); at !== -1; at = lower.indexOf(term, at + term.length)) found.push([at, at + term.length]);
  }
  found.sort((a, b) => a[0] - b[0]);
  const merged: number[] = [];
  for (const [start, end] of found) {
    if (merged.length > 0 && start <= merged[merged.length - 1]!) merged[merged.length - 1] = Math.max(merged[merged.length - 1]!, end);
    else merged.push(start, end);
  }
  return merged;
}

/** A matched part of a drawn text: where it starts from the text's start, how wide it is, and its letters. */
interface Mark {
  left: number;
  width: number;
  text: string;
}

const NONE: readonly Mark[] = [];
const MAX_CACHED = 2000;

/** Per font, the marks of the current search in each text drawn. */
const marksByFont = new Map<string, { query: string; terms: string[]; marks: Map<string, readonly Mark[]> }>();

function marksOf(ctx: CanvasRenderingContext2D, text: string, query: string): readonly Mark[] {
  const font = ctx.font;
  let bucket = marksByFont.get(font);
  if (!bucket || bucket.query !== query) marksByFont.set(font, (bucket = { query, terms: searchTerms(query), marks: new Map() }));
  let marks = bucket.marks.get(text);
  if (marks === undefined) {
    const ranges = matchRanges(text, bucket.terms);
    const found: Mark[] = [];
    for (let i = 0; i < ranges.length; i += 2) {
      const left = ctx.measureText(text.slice(0, ranges[i])).width;
      found.push({ left, width: ctx.measureText(text.slice(0, ranges[i + 1])).width - left, text: text.slice(ranges[i], ranges[i + 1]) });
    }
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
