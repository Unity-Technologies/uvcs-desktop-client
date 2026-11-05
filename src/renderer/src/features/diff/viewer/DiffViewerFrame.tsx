import { useContext, type ReactNode, type Ref } from 'react';
import { ExpandableDiffContext } from '../../../components/expandableDiffContext';
import { ExpandDiffButton } from '../../../components/ExpandDiffButton';
import { PaneToolbar } from '../../../ui/PaneToolbar';
import styles from './DiffViewerFrame.module.css';

interface DiffViewerFrameProps {
  /** Left of the toolbar, e.g. the file path and its status. */
  title?: ReactNode;
  /** Right of the toolbar: how to view the diff. */
  controls?: ReactNode;
  /** The change arrows, last at the right edge: `SteppedDiffFrame`'s, or an xlink's `FileOnlyNavigator`. */
  navigator: ReactNode;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/**
 * A diff under its header: its title, how to view it, the Expand button where its host can give it the whole window
 * (`ExpandableDiffContext`), and last, at the right edge, the change arrows. Every diff of a host draws the same slots
 * (text, image, model, binary, identical, loading, an error), so the arrows stand in the same place from file to file
 * and never move under a pointer clicking ↓ through a changeset.
 */
export function DiffViewerFrame({ title, controls, navigator, children, ref }: DiffViewerFrameProps) {
  const expandable = useContext(ExpandableDiffContext);
  return (
    <div ref={ref} className={styles.viewer}>
      <PaneToolbar title={title}>
        {controls}
        {expandable && <ExpandDiffButton />}
        {navigator}
      </PaneToolbar>
      {children}
    </div>
  );
}
