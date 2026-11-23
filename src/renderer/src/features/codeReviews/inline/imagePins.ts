import { createContext } from 'react';
import type { ReviewThread } from '../conversation/reviewThreads';
import { anchorPath, isImageThread } from './fileThreads';

/**
 * The number each thread on an image shows on its pin, and the header and the Comments panel name it by ("pin 2"):
 * 1, 2, 3… per image, in the order its threads were started, so a pin keeps its number as others are added. Numbered
 * by the path the comment names, every revision's together, so a pin keeps its number as the image changes.
 */
export function imagePinNumbers(threads: readonly ReviewThread[]): ReadonlyMap<number, number> {
  const numbers = new Map<number, number>();
  const counts = new Map<string, number>();
  const onImages = threads.filter(isImageThread).sort((a, b) => a.root.id - b.root.id);
  for (const thread of onImages) {
    const path = anchorPath(thread.root.anchor);
    const count = (counts.get(path) ?? 0) + 1;
    counts.set(path, count);
    numbers.set(thread.root.id, count);
  }
  return numbers;
}

/** The pins' numbers of the review shown (`imagePinNumbers`): read by every card naming a thread on an image. */
export const ImagePinNumbersContext = createContext<ReadonlyMap<number, number>>(new Map());
