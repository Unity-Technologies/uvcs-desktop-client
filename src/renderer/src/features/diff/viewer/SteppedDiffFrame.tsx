import { useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { ChangeNavigator } from './ChangeNavigator';
import { DiffFrameHostContext, headerArrows, type DiffFrameHost, type HeaderState, type PublishedNavigation } from './diffFrameHost';
import { DiffViewerFrame } from './DiffViewerFrame';
import { FileStepsContext } from './fileSteps';
import { StepQueue } from './stepQueue';
import { useFileOnlyNavigation } from './useFileOnlyNavigation';
import styles from './SteppedDiffFrame.module.css';

// A store, not state of the frame: the body publishes on every render, and state here would render the body again on
// every publish, which publishes again: a loop. Only the arrows listen to it.
type PublishedStore = StoreApi<{ published: PublishedNavigation | null }>;

/** What the frame knows of the file selected: its versions' key (`diffContentsKey`) and how their read stands. */
export type RequestedDiff = Omit<HeaderState, 'published' | 'requestedKey'> & {
  key: string;
  /** Its path, as the list beside it names it: what the presses kept for it are tagged with. */
  path: string;
};

interface SteppedDiffFrameProps {
  title?: ReactNode;
  /** Its diffs step through their changes (as `LoadedFileDiff`'s `stepsThroughChanges`): off where the view steps instead. */
  stepsThroughChanges?: boolean;
  requested: RequestedDiff;
  /** The diff, loading, loaded (`LoadedFileDiff`, which draws into this header: `DiffFrameHostContext`) or failed. */
  children?: ReactNode;
}

/**
 * The header of a diff that outlives the diff's body: the body is mounted anew for each file (and drawn once its
 * versions are read), the header, its arrows and their buttons stay. Until the selected file's diff is the body, the
 * arrows show no place of another file's and keep the presses, in one queue for the frame (`StepQueue`), for that diff
 * to take once it opened (`headerArrows`). So a burst of ↓ clicks through a changeset never loses one to a button that
 * went away, nor lands one on the wrong file.
 */
export function SteppedDiffFrame({ title, stepsThroughChanges = true, requested, children }: SteppedDiffFrameProps) {
  const frame = useRef<HTMLDivElement>(null);
  const [controls, setControls] = useState<HTMLElement | null>(null);
  const [store] = useState<PublishedStore>(() => createStore(() => ({ published: null })));
  // The list's (shared by the lists of one view, so a step into a file shown otherwise hands it its presses), else its own.
  const [ownQueue] = useState(() => new StepQueue());
  const queue = useContext(FileStepsContext)?.kept ?? ownQueue;
  // Stable while the frame lives: the body's unmount hands the arrows back to the header (`publish(null)`) once only.
  const publish = useMemo(() => (published: PublishedNavigation | null) => store.setState({ published }), [store]);
  const host = useMemo<DiffFrameHost>(() => ({ frame, controls, publish, queue, requestedKey: requested.key }), [controls, publish, queue, requested.key]);
  const navigator = <HostedNavigator store={store} queue={queue} frame={frame} hostSteps={stepsThroughChanges} requested={requested} />;
  return (
    <DiffViewerFrame ref={frame} title={title} controls={<span ref={setControls} className={styles.controls} />} navigator={navigator}>
      <DiffFrameHostContext.Provider value={host}>{children}</DiffFrameHostContext.Provider>
    </DiffViewerFrame>
  );
}

interface HostedNavigatorProps {
  store: PublishedStore;
  queue: StepQueue;
  frame: RefObject<HTMLDivElement | null>;
  hostSteps: boolean;
  requested: RequestedDiff;
}

/** The arrows (`headerArrows`): the selected file's diff's, else the header's own, which keep presses for it. */
function HostedNavigator({ store, queue, frame, hostSteps, requested }: HostedNavigatorProps) {
  const published = useStore(store, (state) => state.published);
  const files = useContext(FileStepsContext);
  const { key, path, ...read } = requested;
  const arrows = headerArrows({ published, requestedKey: key, ...read });
  // The arrows step with the body's navigation once it's the selected file's (`shown`); else with the header's own,
  // which keeps the presses for that file's diff or, where it couldn't be read, replays them from file to file.
  const kept = useMemo(() => ({ queue, takes: true }), [queue]);
  const header = useFileOnlyNavigation(frame, { active: arrows.body === null, holder: arrows.own, path, kept });
  // The file shown changed under the same row (an asset's `.meta` toggled in its place): the presses kept for the one
  // left (not for this one, nor for one a step is on its way to) go; they'd never be taken, and would come back with
  // it. The list moving is `FileSteps.listMoved`'s. Only when the file asked for changes (`[path]`): other renders leave
  // nothing, and the queue may be the list's, shared with a view this frame doesn't see (Incoming's conflicts).
  useEffect(() => queue.keepOnly([path, files?.steppingTo() ?? null]), [path]);
  const shown = arrows.body ?? { navigation: header, stepsOwn: false };
  return <ChangeNavigator navigation={shown.navigation} stepsOwn={shown.stepsOwn} hostSteps={hostSteps} keysWhileTyping />;
}
