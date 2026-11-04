import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { ChangeNavigator } from './ChangeNavigator';
import { DiffFrameHostContext, headerTakesKeys, hostedNavigation, type DiffFrameHost, type PublishedNavigation } from './diffFrameHost';
import { DiffViewerFrame } from './DiffViewerFrame';
import { useFileOnlyNavigation } from './useFileOnlyNavigation';
import styles from './SteppedDiffFrame.module.css';

type PublishedStore = StoreApi<{ published: PublishedNavigation | null }>;

interface SteppedDiffFrameProps {
  title?: ReactNode;
  /** The diff, loading, loaded (`LoadedFileDiff`, which draws into this header: `DiffFrameHostContext`) or failed. */
  children?: ReactNode;
}

/**
 * The header of a diff that outlives the diff's body: the body is mounted anew for each file (and drawn once its
 * versions are read), the header, its arrows and their buttons stay. While no body publishes its navigation (loading,
 * an error) the arrows go from file to file; once one does, the same buttons step through its changes. So a burst of ↓
 * clicks through a changeset never lands half a click on a button that went away.
 */
export function SteppedDiffFrame({ title, children }: SteppedDiffFrameProps) {
  const frame = useRef<HTMLDivElement>(null);
  const [controls, setControls] = useState<HTMLElement | null>(null);
  const [store] = useState<PublishedStore>(() => createStore(() => ({ published: null })));
  // Stable while the frame lives: the body's unmount hands the arrows back to the header (`publish(null)`) once only.
  const publish = useMemo(() => (published: PublishedNavigation | null) => store.setState({ published }), [store]);
  const host = useMemo<DiffFrameHost>(() => ({ frame, controls, publish }), [controls, publish]);
  return (
    <DiffViewerFrame ref={frame} title={title} controls={<span ref={setControls} className={styles.controls} />} navigator={<HostedNavigator store={store} frame={frame} />}>
      <DiffFrameHostContext.Provider value={host}>{children}</DiffFrameHostContext.Provider>
    </DiffViewerFrame>
  );
}

/** The arrows: the body's navigation once published (`hostedNavigation`), else the header's own, file to file. */
function HostedNavigator({ store, frame }: { store: PublishedStore; frame: RefObject<HTMLDivElement | null> }) {
  const published = useStore(store, (state) => state.published);
  const header = useFileOnlyNavigation(frame, headerTakesKeys(published));
  const shown = hostedNavigation(published, header);
  return <ChangeNavigator navigation={shown.navigation} stepsOwn={shown.stepsOwn} keysWhileTyping />;
}
