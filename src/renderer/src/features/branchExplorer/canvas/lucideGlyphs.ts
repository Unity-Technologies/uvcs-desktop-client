import type { CodeReviewStatus, MergeRequestState } from '@shared/domain/codeReview';
import type { MergeVerdict } from '../../codeReviews/mergeVerdict';

/** One shape of a 24-unit icon, as lucide draws it: stroked, 2 units wide, round caps and joins. */
export type GlyphShape =
  | readonly ['circle', { cx: number; cy: number; r: number }]
  | readonly ['line', { x1: number; y1: number; x2: number; y2: number }]
  | readonly ['path', { d: string }];

export type Glyph = readonly GlyphShape[];

/**
 * The glyphs the canvas draws for a merge request's state and a review's status, the very icons the rest of the app
 * shows (`MERGE_REQUEST_STATE_ICONS`, `REVIEW_STATUS_ICONS`, from lucide, ISC license), so a branch's chip reads the same
 * on the canvas as in the lists. lucide-react keeps their shapes private: they're written here, and
 * `lucideGlyphs.test.ts` fails when they drift from the icons installed.
 */
export const STATE_GLYPHS: Record<MergeRequestState, Glyph> = {
  Open: [
    ['circle', { cx: 18, cy: 18, r: 3 }],
    ['circle', { cx: 6, cy: 6, r: 3 }],
    ['path', { d: 'M13 6h3a2 2 0 0 1 2 2v7' }],
    ['line', { x1: 6, x2: 6, y1: 9, y2: 21 }],
  ],
  Draft: [
    ['circle', { cx: 18, cy: 18, r: 3 }],
    ['circle', { cx: 6, cy: 6, r: 3 }],
    ['path', { d: 'M18 6V5' }],
    ['path', { d: 'M18 11v-1' }],
    ['line', { x1: 6, x2: 6, y1: 9, y2: 21 }],
  ],
  Merged: [
    ['circle', { cx: 18, cy: 18, r: 3 }],
    ['circle', { cx: 6, cy: 6, r: 3 }],
    ['path', { d: 'M6 21V9a9 9 0 0 0 9 9' }],
  ],
  Closed: [
    ['path', { d: 'm15.5 3.5 5 5' }],
    ['path', { d: 'm15.5 8.5 5-5' }],
    ['path', { d: 'M18 11.62V15' }],
    ['path', { d: 'M6 9v12' }],
    ['circle', { cx: 18, cy: 18, r: 3 }],
    ['circle', { cx: 6, cy: 6, r: 3 }],
  ],
};

export const STATUS_GLYPHS: Record<CodeReviewStatus, Glyph> = {
  'Under review': [
    ['path', { d: 'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0' }],
    ['circle', { cx: 12, cy: 12, r: 3 }],
  ],
  'Rework required': [
    ['path', { d: 'M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528' }],
  ],
  Reviewed: [
    ['path', { d: 'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z' }],
    ['path', { d: 'M7 10v12' }],
  ],
};

/** A merge request's verdict (`MergeVerdictIcon`: lucide's check and x). */
export const VERDICT_GLYPHS: Record<MergeVerdict, Glyph> = {
  ready: [['path', { d: 'M20 6 9 17l-5-5' }]],
  blocked: [
    ['path', { d: 'M18 6 6 18' }],
    ['path', { d: 'm6 6 12 12' }],
  ],
};

/** The units a glyph's shapes are drawn in. */
export const GLYPH_UNITS = 24;
