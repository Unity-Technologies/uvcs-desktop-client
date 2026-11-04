import { createContext, type RefObject } from 'react';
import type { StepNavigation } from './useStepNavigation';

/** A diff's own way through its changes, handed to the header that draws its arrows (`SteppedDiffFrame`). */
export interface PublishedNavigation {
  navigation: StepNavigation;
  /** It steps through changes of its own (a text diff), not only files. */
  stepsOwn: boolean;
}

/**
 * The header a diff body draws into (`SteppedDiffFrame`), which outlives it: the body (`LoadedFileDiff`) is mounted anew
 * for each file, the header and its arrows stay, so ↓ clicked through a changeset always lands on the same button.
 */
export interface DiffFrameHost {
  /** The frame, the view and its header: where the body's keys work from (`useStepNavigation`'s `frame`). */
  frame: RefObject<HTMLDivElement | null>;
  /** Where the body draws its controls (`createPortal`), before the Expand button and the arrows. */
  controls: HTMLElement | null;
  /** The body's navigation, each time it renders; none once it's gone. */
  publish: (published: PublishedNavigation | null) => void;
}

export const DiffFrameHostContext = createContext<DiffFrameHost | null>(null);

/** What the header's arrows show: the body's navigation once it published one, else the header's own, file to file. */
export function hostedNavigation(published: PublishedNavigation | null, headerNavigation: StepNavigation): PublishedNavigation {
  return published ?? { navigation: headerNavigation, stepsOwn: false };
}

/** Whether the header's own (file-only) navigation takes the keys: only while no body published one, never both. */
export function headerTakesKeys(published: PublishedNavigation | null): boolean {
  return published === null;
}
