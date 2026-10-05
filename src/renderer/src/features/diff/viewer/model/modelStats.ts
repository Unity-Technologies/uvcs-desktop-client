// The info strip's figures: what a budget and a glance check, in the words of Unity's Statistics window (Tris,
// Verts). Each figure shows once, as "before → after" only where it changed, so what changed stands out.

import { formatCount } from '../../../../lib/text';
import type { ModelSummary } from './modelSummary';
import { formatLength } from './modelUnits';

export interface ModelStat {
  label: string;
  /** The figure in each version shown; equal ones show once. */
  before: string | null;
  after: string | null;
  /** Its tooltip: what the figure is. */
  tip?: string;
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
