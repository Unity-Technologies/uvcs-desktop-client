import { useRef } from 'react';
import type { ModelBytes } from '@shared/domain/content';
import { sameBytes } from './sameBytes';

/**
 * The model as first read while its bytes stay the same: a pending file read again (a focus, a refresh) comes as new
 * arrays, and everything the viewer keeps by the model (its read, its scene, its comparison) would be made again.
 */
export function useStableModel(model: ModelBytes | undefined): ModelBytes | undefined {
  const kept = useRef(model);
  const previous = kept.current;
  if (model && previous && model !== previous && model.format === previous.format && sameBytes(model.bytes, previous.bytes)) return previous;
  kept.current = model;
  return model;
}
