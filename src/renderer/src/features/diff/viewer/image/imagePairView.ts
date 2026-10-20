// What the image diff shows of a pair of versions, once each is decoded or failed: the two compared, one alone (added,
// deleted, or the other can't be painted: a PSD saved again without "Maximize Compatibility" still shows the version
// before, with why the version after doesn't), or nothing paints and the diff says why.

import type { ImageProblem } from '../../../../lib/images/imageProblems';
import type { DecodedImage, DecodeState } from './useDecodedImage';

export type ImageSide = 'old' | 'new';

export type ImagePairView =
  | { kind: 'loading' }
  /** No version paints: the binary diff, saying why. */
  | { kind: 'unpainted'; problem: ImageProblem }
  /** What paints; `unpainted` names the version that doesn't, beside one that does. */
  | { kind: 'painted'; old: DecodedImage | null; new: DecodedImage | null; unpainted: { side: ImageSide; problem: ImageProblem } | null };

export function imagePairView(old: DecodeState, next: DecodeState): ImagePairView {
  if (old.status === 'loading' || next.status === 'loading') return { kind: 'loading' };
  const shown = { old: imageOf(old), new: imageOf(next) };
  if (old.status !== 'error' && next.status !== 'error') return { kind: 'painted', ...shown, unpainted: null };
  if (old.status === 'error' && shown.new) return { kind: 'painted', ...shown, unpainted: { side: 'old', problem: old.problem } };
  if (next.status === 'error' && shown.old) return { kind: 'painted', ...shown, unpainted: { side: 'new', problem: next.problem } };
  const problems = [old, next].flatMap((state) => (state.status === 'error' ? [state.problem] : []));
  // Too large reads as any image too large to preview does, whichever version it is.
  return { kind: 'unpainted', problem: problems.includes('tooLarge') ? 'tooLarge' : problems[0]! };
}

function imageOf(state: DecodeState): DecodedImage | null {
  return state.status === 'ready' ? state.image : null;
}
