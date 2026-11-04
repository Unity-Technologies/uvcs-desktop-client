import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { ChangeNavigator } from './ChangeNavigator';
import { DiffFrameHostContext, headerArrows, queuedStep, type DiffFrameHost, type PublishedNavigation } from './diffFrameHost';
import { DiffViewerFrame } from './DiffViewerFrame';
import { useFileOnlyNavigation } from './useFileOnlyNavigation';
import styles from './SteppedDiffFrame.module.css';

// A store, not state of the frame: the body publishes on every render, and state here would render the body again on
// every publish, which publishes again: a loop. Only the arrows listen to it.
type PublishedStore = StoreApi<{ published: PublishedNavigation | null }>;

interface SteppedDiffFrameProps {
  title?: ReactNode;
  /** Its diffs step through their changes (as `LoadedFileDiff`'s `stepsThroughChanges`): off where the view steps instead. */
  stepsThroughChanges?: boolean;
  /** The body drawn is the selected file's, not the previous one kept on screen while the next loads. */
  bodyCurrent?: boolean;
  /** The selected file's versions are being read. */
  loading?: boolean;
  /** The diff, loading, loaded (`LoadedFileDiff`, which draws into this header: `DiffFrameHostContext`) or failed. */
  children?: ReactNode;
}

/**
 * The header of a diff that outlives the diff's body: the body is mounted anew for each file (and drawn once its
 * versions are read), the header, its arrows and their buttons stay. While the selected file's diff isn't the body
 * (loading, an error) the arrows show no place of another file's; presses made while it loads wait for it
 * (`headerArrows`, `queuedStep`). So a burst of ↓ clicks through a changeset never loses one to a button that went away,
 * nor lands one on the wrong file.
 */
export function SteppedDiffFrame({ title, stepsThroughChanges = true, bodyCurrent = true, loading = false, children }: SteppedDiffFrameProps) {
  const frame = useRef<HTMLDivElement>(null);
  const [controls, setControls] = useState<HTMLElement | null>(null);
  const [store] = useState<PublishedStore>(() => createStore(() => ({ published: null })));
  // Stable while the frame lives: the body's unmount hands the arrows back to the header (`publish(null)`) once only.
  const publish = useMemo(() => (published: PublishedNavigation | null) => store.setState({ published }), [store]);
  const host = useMemo<DiffFrameHost>(() => ({ frame, controls, publish }), [controls, publish]);
  const navigator = <HostedNavigator store={store} frame={frame} hostSteps={stepsThroughChanges} bodyCurrent={bodyCurrent} loading={loading} />;
  return (
    <DiffViewerFrame ref={frame} title={title} controls={<span ref={setControls} className={styles.controls} />} navigator={navigator}>
      <DiffFrameHostContext.Provider value={host}>{children}</DiffFrameHostContext.Provider>
    </DiffViewerFrame>
  );
}

interface HostedNavigatorProps {
  store: PublishedStore;
  frame: RefObject<HTMLDivElement | null>;
  hostSteps: boolean;
  bodyCurrent: boolean;
  loading: boolean;
}

/** The arrows (`headerArrows`), and the presses kept while a file loads, applied one by one once it arrived. */
function HostedNavigator({ store, frame, hostSteps, bodyCurrent, loading }: HostedNavigatorProps) {
  const published = useStore(store, (state) => state.published);
  const queue = useRef<(1 | -1)[]>([]);
  const arrows = headerArrows({ published, bodyCurrent, loading });
  const header = useFileOnlyNavigation(frame, arrows.headerKeys, arrows.queues ? (direction) => void queue.current.push(direction) : undefined);

  // Each render (the body publishes as it renders, so after each of its steps), the next press kept, once it may apply.
  useEffect(() => {
    const next = queuedStep(queue.current, arrows);
    if (next.kind === 'drop') queue.current = [];
    if (next.kind !== 'apply' || !arrows.body) return;
    queue.current.shift();
    arrows.body.navigation.go(next.direction);
  });

  const shown = arrows.body ?? { navigation: header, stepsOwn: false };
  return <ChangeNavigator navigation={shown.navigation} stepsOwn={shown.stepsOwn} hostSteps={hostSteps} keysWhileTyping />;
}
