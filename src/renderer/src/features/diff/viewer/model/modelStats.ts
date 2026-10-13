// The info strip's figures: what a budget and a glance check, in the words of Unity's Statistics window (Tris,
// Verts). Each figure shows once, as "before → after" only where it changed, so what changed stands out.

import { formatCount } from '../../../../lib/text';
import type { TexturesReport } from './materials/materialPlan';
import { textureProblemWords } from './textures/textureProblems';
import type { ModelSummary } from './modelSummary';
import { changeShares, type SurfaceComparison } from './surfaceComparison';
import { formatLength } from './modelUnits';

export interface ModelStat {
  label: string;
  /** The figure in each version shown; equal ones show once. */
  before: string | null;
  after: string | null;
  /** Its tooltip: what the figure is. */
  tip?: string;
  /** Work under way behind the figure: how far along (0..1), or null where that isn't known yet; none when done. */
  progress?: number | null;
}

export function modelStats(before: ModelSummary | null, after: ModelSummary | null): ModelStat[] {
  const stat = (label: string, value: (summary: ModelSummary) => string | null, tip?: string): ModelStat | null => {
    const old = before && value(before);
    const next = after && value(after);
    if (old === null && next === null) return null;
    return { label, before: old, after: next, ...(tip && { tip }) };
  };
  const optional = (count: (summary: ModelSummary) => number) => (summary: ModelSummary) => (count(summary) > 0 ? formatCount(count(summary)) : null);
  return [
    stat('Tris', (summary) => formatCount(summary.totals.triangles), 'Triangles'),
    stat('Verts', (summary) => formatCount(summary.totals.vertices), "Vertices, about as Unity counts them once imported: corners that share every attribute are one"),
    stat('Materials', (summary) => formatCount(summary.totals.materials), 'Material slots'),
    stat('Bones', optional((summary) => summary.totals.bones)),
    stat('Blendshapes', optional((summary) => summary.totals.blendShapes)),
    stat('Animations', optional((summary) => summary.clips.length)),
    stat('Size', (summary) => sizeOf(summary, largestSide(before, after)), 'Width × height × depth in Unity'),
  ].filter((value): value is ModelStat => value !== null);
}

/**
 * The Differences mode's figure: how much of the version after moved past the tolerance, and the farthest any part
 * moved, "12% · up to 4.2 cm"; "None" when nothing did.
 */
export function movedStat(comparison: SurfaceComparison, tolerance: number): ModelStat {
  const { moved, gone, farthest } = changeShares(comparison, tolerance);
  const tip = 'The share of the vertices that moved more than the tolerance, and the farthest any did';
  if (moved === 0 && gone === 0) return { label: 'Moved', before: null, after: 'None', tip };
  const share = moved > 0 && moved < 0.01 ? '<1%' : `${Math.round(moved * 100)}%`;
  // As far as the measure goes: a part that came or went, which is farther than any number.
  const beyond = farthest >= comparison.maxDistance * 0.999 ? '+' : '';
  return { label: 'Moved', before: null, after: `${share} · up to ${formatLength(farthest)}${beyond}`, tip };
}

/** "1.71 × 1.72 × 3.93 m": the three in the unit that reads `largest`, so both versions read in one unit. */
function sizeOf(summary: ModelSummary, largest: number): string | null {
  if (!summary.bounds) return null;
  const sizes = sidesOf(summary);
  const unit = formatLength(largest).split(' ')[1]!;
  const metresPerUnit = UNIT_METRES[unit] ?? 1;
  return `${sizes.map((size) => String(Number((size / metresPerUnit).toPrecision(SIGNIFICANT_DIGITS)))).join(' × ')} ${unit}`;
}

function sidesOf(summary: ModelSummary): number[] {
  return summary.bounds ? [0, 1, 2].map((axis) => summary.bounds!.max[axis]! - summary.bounds!.min[axis]!) : [];
}

/** The largest side of either version, in metres. */
function largestSide(...summaries: (ModelSummary | null)[]): number {
  return Math.max(0, ...summaries.flatMap((summary) => (summary ? sidesOf(summary) : [])));
}

/** Enough to read a 9 mm side beside a 1 m one (0.009 m), not so many that a size reads like noise. */
const SIGNIFICANT_DIGITS = 3;

const UNIT_METRES: Record<string, number> = { m: 1, cm: 0.01, mm: 0.001 };

/** How many texture problems the chip's tooltip names before "and N more". */
const LISTED_ISSUES = 8;

/**
 * The Materials look's figure: the textures that show of those the materials use, "9 of 12" (or "12"), its tooltip
 * naming the ones that don't and why. None for materials without textures.
 */
export function texturesStat(report: TexturesReport): ModelStat | null {
  const { total, shown, loading, downloading, issues, finding } = report;
  if (total === 0) return finding ? { label: 'Textures', before: null, after: null, tip: 'Finding the materials and textures…', progress: null } : null;
  const lines = ['Textures shown'];
  for (const issue of issues.slice(0, LISTED_ISSUES)) lines.push(`${issue.name}: ${textureProblemWords(issue.problem)}`);
  if (issues.length > LISTED_ISSUES) lines.push(`and ${formatCount(issues.length - LISTED_ISSUES)} more`);
  if (downloading > 0) lines.push(`Getting ${formatCount(downloading)} from the repository…`);
  if (loading > downloading) lines.push(`Loading ${formatCount(loading - downloading)}…`);
  if (finding) lines.push("Finding the other version's materials and textures…");
  // Counting up while they load, a ring filling beside: what may take a while (a download) shows it's under way.
  const count = shown === total ? formatCount(total) : `${formatCount(shown)} of ${formatCount(total)}`;
  const busy = loading > 0 || finding;
  return { label: 'Textures', before: null, after: count, tip: lines.join('\n'), ...(busy && { progress: finding ? null : shown / total }) };
}
