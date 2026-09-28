import { ScanText } from 'lucide-react';
import { useRef } from 'react';
import type { TreeItem } from '@shared/domain/explorer';
import { focusMain } from '../../lib/mainFocus';
import { hotkey } from '../../lib/shortcutRegistry';
import { matchesShortcut } from '../../lib/shortcuts';
import { useShortcut } from '../../lib/useShortcut';
import { Button } from '../../ui/Button';
import { AnnotationPane } from '../annotate/AnnotationPane';
import { FileDiffViewer } from '../diff/viewer/FileDiffViewer';
import { ChangeDiffPanel } from '../pendingChanges/ChangeDiffPanel';
import { ComparisonTitle } from './ComparisonTitle';
import { useFilesViewStore } from './filesViewStore';
import { canAnnotateComparison, type ItemComparison } from './itemComparison';
import { itemRevision } from './itemRevision';
import { RevisionChanges } from './RevisionChanges';
import { viewerFocusTarget } from './viewerFocus';
import styles from './ItemViewer.module.css';

interface ItemViewerProps {
  workspacePath: string;
  item: TreeItem;
  comparison: ItemComparison;
  /** The last change's comment, once read. */
  comment?: string;
}

/**
 * The selected file under its heading, as big as the pane allows: one diff, the most telling for its status
 * (`itemComparison`), saying what it compares; or, with the toggle beside that, the file annotated. The tree keeps the
 * keyboard; F6 moves it into the file to scroll it, and F6 or Esc back.
 */
export function ItemViewer({ workspacePath, item, comparison, comment }: ItemViewerProps) {
  const { detailsTab, setDetailsTab } = useFilesViewStore();
  const annotatable = canAnnotateComparison(comparison);
  const annotating = annotatable && detailsTab === 'annotate';
  const viewerRef = useRef<HTMLDivElement>(null);

  useShortcut(hotkey('fileViewer'), () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (viewer.contains(document.activeElement)) focusMain(document);
    else viewerFocusTarget(viewer).focus({ preventScroll: true });
  });
  const leave = (event: React.KeyboardEvent): void => {
    if (event.defaultPrevented || !matchesShortcut(event.nativeEvent, hotkey('leaveFileViewer'))) return;
    event.preventDefault();
    focusMain(document);
  };

  const annotateToggle = annotatable && (
    <Button
      size="small"
      variant={annotating ? 'secondary' : 'ghost'}
      icon={<ScanText size={13} />}
      aria-pressed={annotating}
      data-tip={annotating ? 'Back to the diff' : 'Who last changed each line'}
      onClick={() => setDetailsTab(annotating ? 'changes' : 'annotate')}
    >
      Annotate
    </Button>
  );
  const title = (
    <>
      <ComparisonTitle item={item} comparison={comparison} comment={comment} />
      {annotateToggle}
    </>
  );

  return (
    <div ref={viewerRef} className={styles.viewer} tabIndex={-1} onKeyDown={leave}>
      {annotating ? (
        // A file with changes is annotated as it is on disk; any other as its revision, read once.
        <AnnotationPane key={item.path} path={item.path} repository={item.repository} revision={comparison.kind === 'changes' ? undefined : itemRevision(item)} leading={annotateToggle} />
      ) : comparison.kind === 'lastChange' ? (
        <RevisionChanges workspacePath={workspacePath} item={item} title={title} />
      ) : comparison.change ? (
        <ChangeDiffPanel workspacePath={workspacePath} change={comparison.change} title={title} />
      ) : (
        <FileDiffViewer workspacePath={workspacePath} original={{ kind: 'empty' }} modified={{ kind: 'workspaceFile', path: item.path }} fileName={item.name} title={title} />
      )}
    </div>
  );
}
