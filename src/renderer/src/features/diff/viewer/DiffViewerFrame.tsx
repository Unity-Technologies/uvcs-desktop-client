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
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/**
 * A diff under its header. Where its host can give it the whole window (`ExpandableDiffContext`), the header ends with
 * the Expand button, after the change arrows: in the same place for every file and while one loads.
 */
export function DiffViewerFrame({ title, controls, children, ref }: DiffViewerFrameProps) {
  const expandable = useContext(ExpandableDiffContext);
  return (
    <div ref={ref} className={styles.viewer} data-diff-frame="">
      <PaneToolbar title={title}>
        {controls}
        {expandable && <ExpandDiffButton />}
      </PaneToolbar>
      {children}
    </div>
  );
}
