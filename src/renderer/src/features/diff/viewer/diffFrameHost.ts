import { createContext, type RefObject } from 'react';
import type { ContentSource } from '@shared/domain/content';
import type { StepQueue } from './stepQueue';
import type { StepNavigation } from './useStepNavigation';

/** A diff's own way through its changes, handed to the header that draws its arrows (`SteppedDiffFrame`). */
export interface PublishedNavigation {
  navigation: StepNavigation;
  /** It steps through changes of its own (a text diff), not only files. */
  stepsOwn: boolean;
  /** Whose it is: the versions the diff shows (`diffContentsKey`), so the header never trusts a previous file's. */
  key: string;
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
  /** The presses made before the selected file's diff opened, which that diff drains once it did. */
  queue: StepQueue;
  /** The selected file's versions (`diffContentsKey`): a diff of others (the previous file's, still on screen) takes no keys. */
  requestedKey: string;
}

export const DiffFrameHostContext = createContext<DiffFrameHost | null>(null);

/** The versions a diff shows, as a key: whose a published navigation and a press kept are. */
export function diffContentsKey(original: ContentSource, modified: ContentSource): string {
  return JSON.stringify([original, modified]);
}

/** Where the header stands with the file selected. */
export interface HeaderState {
  /** The body's navigation, as it last rendered; none while no body is drawn (the first read, an error). */
  published: PublishedNavigation | null;
  /** The selected file's versions (`diffContentsKey`). */
  requestedKey: string;
  /** Its versions couldn't be read. */
  error: boolean;
  /** Versions are at hand, the selected file's or, while it's read, the previous file's (`isPlaceholderData`). */
  hasData: boolean;
  isPlaceholderData: boolean;
}

/** What the header's arrows show and do. */
export interface HeaderArrows {
  /** The body's navigation the arrows step with; none while they're the header's own (no label). */
  body: PublishedNavigation | null;
  /** The header's own navigation takes the keys (never both it and the body's). */
  headerKeys: boolean;
  /** The header's presses wait for the selected file's diff (`StepQueue`), rather than stepping from another file. */
  queues: boolean;
  /** The presses kept are dropped: the selected file couldn't be read, so the diff they were meant for never comes. */
  dropsKept: boolean;
}

/**
 * The header's arrows: the body's navigation, label and keys while the body published is the selected file's diff;
 * otherwise the header's own, with no label (never the previous file's "3 of 3" beside this one's title), which keeps
 * the presses for the selected file's diff while it's read or drawn, and where it couldn't be read goes from file to
 * file at once. A body is the selected file's only when its key says so: the diff of a file read fast mounts while the
 * previous one's navigation is still the one published (publishing follows the render).
 */
export function headerArrows({ published, requestedKey, error, hasData, isPlaceholderData }: HeaderState): HeaderArrows {
  if (error) return { body: null, headerKeys: true, queues: false, dropsKept: true };
  const current = hasData && !isPlaceholderData && published !== null && isSelectedFile(published.key, requestedKey);
  if (current) return { body: published, headerKeys: false, queues: false, dropsKept: false };
  return { body: null, headerKeys: true, queues: true, dropsKept: false };
}

/** Whether a diff is the selected file's, not a previous one kept on screen while the next is read: by its versions. */
export function isSelectedFile(ownKey: string, requestedKey: string): boolean {
  return ownKey === requestedKey;
}

/** Where a press on the header's arrows goes. */
export type HeaderPress = { kind: 'body' } | { kind: 'keep'; path: string } | { kind: 'step' };

/**
 * A press on the header's arrows (`headerArrows`): to the selected file's diff once it's the one published; while it's
 * read or drawn, kept for the file a step is on its way to (`FileSteps.steppingTo`), else for the file asked for; where
 * it couldn't be read, a step from file to file.
 */
export function headerPress(arrows: HeaderArrows, { steppingTo, requestedPath }: { steppingTo: string | null; requestedPath: string }): HeaderPress {
  if (arrows.body) return { kind: 'body' };
  return arrows.queues ? { kind: 'keep', path: steppingTo ?? requestedPath } : { kind: 'step' };
}

/** Whether a diff takes the presses kept for it: once it opened at its arrival, while it's the selected file's. */
export function drainsKept({ opened, selected }: { opened: boolean; selected: boolean }): boolean {
  return opened && selected;
}
