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

/** Where the header stands with the file selected. */
export interface HeaderState {
  /** The body's navigation, as it last rendered; none while no body is drawn (the first read, an error). */
  published: PublishedNavigation | null;
  /** The body drawn is the selected file's, not the previous file's kept on screen while the next one loads. */
  bodyCurrent: boolean;
  /** The selected file's versions are being read. */
  loading: boolean;
}

/** What the header's arrows show and do. */
export interface HeaderArrows {
  /** The body's navigation the arrows step with; none while they're the header's own (file to file, no label). */
  body: PublishedNavigation | null;
  /** The header's own navigation takes the keys (never both it and the body's). */
  headerKeys: boolean;
  /** Presses wait for the file loading (`queuedStep`), rather than stepping from a file no longer selected. */
  queues: boolean;
}

/**
 * The header's arrows: the body's navigation, label and keys while the body is the selected file's; otherwise the
 * header's own (no label, so never another file's "3 of 3" beside this one's title), which, while the selected file
 * loads, keeps the presses for when it arrives, and where it couldn't be read goes from file to file at once.
 */
export function headerArrows({ published, bodyCurrent, loading }: HeaderState): HeaderArrows {
  if (published && bodyCurrent) return { body: published, headerKeys: false, queues: false };
  // Read but not drawn yet (the viewer's code loading on first use): its diff is coming too.
  return { body: null, headerKeys: true, queues: loading || bodyCurrent };
}

/** What to do with the presses kept while the file loaded. */
export type QueuedStep = { kind: 'none' } | { kind: 'wait' } | { kind: 'apply'; direction: 1 | -1 } | { kind: 'drop' };

/**
 * The presses kept while a file loaded, one at a time: once its diff is the body, each goes to it, which keeps it in
 * turn until it opened at its arrival (`pressWhileOpening`), so ↓ ↓ in a burst ends on the second file's 2nd change, no
 * click lost nor landing on the wrong file. A file that couldn't be read drops them: they were meant for a diff that
 * never came.
 */
export function queuedStep(queue: readonly (1 | -1)[], arrows: HeaderArrows): QueuedStep {
  const next = queue[0];
  if (next === undefined) return { kind: 'none' };
  if (arrows.queues) return { kind: 'wait' };
  return arrows.body ? { kind: 'apply', direction: next } : { kind: 'drop' };
}
