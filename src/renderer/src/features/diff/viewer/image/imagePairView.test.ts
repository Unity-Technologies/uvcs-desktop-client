import { describe, expect, it } from 'vitest';
import type { ImageProblem } from '../../../../lib/images/imageProblems';
import { imagePairView } from './imagePairView';
import type { DecodedImage, DecodeState } from './useDecodedImage';

const decoded = (src: string): DecodedImage => ({ src, element: {} as HTMLImageElement, width: 4, height: 3, highDynamicRange: false });
const ready = (src: string): DecodeState => ({ status: 'ready', image: decoded(src) });
const failed = (problem: ImageProblem): DecodeState => ({ status: 'error', problem });
const IDLE: DecodeState = { status: 'idle' };
const LOADING: DecodeState = { status: 'loading' };

describe('imagePairView', () => {
  it('compares two versions that paint, and shows an added or deleted one alone', () => {
    expect(imagePairView(ready('a'), ready('b'))).toEqual({ kind: 'painted', old: decoded('a'), new: decoded('b'), unpainted: null });
    expect(imagePairView(IDLE, ready('b'))).toEqual({ kind: 'painted', old: null, new: decoded('b'), unpainted: null });
    expect(imagePairView(ready('a'), IDLE)).toEqual({ kind: 'painted', old: decoded('a'), new: null, unpainted: null });
  });

  it('shows the version that paints alone, and why the other one does not', () => {
    expect(imagePairView(ready('a'), failed('psdWithoutComposite'))).toEqual({
      kind: 'painted',
      old: decoded('a'),
      new: null,
      unpainted: { side: 'new', problem: 'psdWithoutComposite' },
    });
    expect(imagePairView(failed('tooLarge'), ready('b'))).toEqual({ kind: 'painted', old: null, new: decoded('b'), unpainted: { side: 'old', problem: 'tooLarge' } });
  });

  it('paints nothing when no version can, telling a size past the limit first', () => {
    expect(imagePairView(failed('unreadable'), failed('tooLarge'))).toEqual({ kind: 'unpainted', problem: 'tooLarge' });
    expect(imagePairView(failed('psdColorMode'), failed('unreadable'))).toEqual({ kind: 'unpainted', problem: 'psdColorMode' });
    expect(imagePairView(IDLE, failed('psdColorMode'))).toEqual({ kind: 'unpainted', problem: 'psdColorMode' });
  });

  it('waits while either version is still being read, so one never shows alone before the other is known', () => {
    expect(imagePairView(LOADING, ready('b'))).toEqual({ kind: 'loading' });
    expect(imagePairView(failed('unreadable'), LOADING)).toEqual({ kind: 'loading' });
  });
});
