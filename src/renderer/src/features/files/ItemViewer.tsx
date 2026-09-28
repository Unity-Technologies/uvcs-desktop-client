import { useRef } from 'react';
import { canAnnotate } from '@shared/domain/annotate';
import type { TreeItem } from '@shared/domain/explorer';
import { focusMain } from '../../lib/mainFocus';
import { hotkey } from '../../lib/shortcutRegistry';
import { matchesShortcut } from '../../lib/shortcuts';
import { useShortcut } from '../../lib/useShortcut';
import { AnnotationPane } from '../annotate/AnnotationPane';
import { FileViewSwitch } from '../annotate/FileViewSwitch';
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
  /** The key that switches "Diff | Annotate", where one does (the Files view's commands). */
  viewShortcut?: string;
}

/**
 * The selected file under its heading, as big as the pane allows: one diff, the most telling for its status
 * (`itemComparison`), saying what it compares; or, switched with "Diff | Annotate" before that, the file annotated.
 * The tree keeps the keyboard; F6 moves it into the file to scroll it, and F6 or Esc back.
 */
export function ItemViewer({ workspacePath, item, comparison, comment, viewShortcut }: ItemViewerProps) {
  const { fileView, setFileView } = useFilesViewStore();
  // A file with changes is annotated as it is on disk; any other as its revision, read once (a shelve's has none to annotate).
  const revision = comparison.kind === 'changes' ? undefined : itemRevision(item);
  const annotatable = canAnnotateComparison(comparison) && canAnnotate(item.itemType) && revision !== null;
  const annotating = annotatable && fileView === 'annotate';
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

  // What can't be annotated (no revision yet, deleted from disk, binary) only shows its diff.
  const viewSwitch = annotatable && (
    <FileViewSwitch
      value={annotating ? 'annotate' : 'diff'}
      onChange={setFileView}
      tips={{ diff: "The file's diff", annotate: 'Who last changed each line' }}
      shortcut={viewShortcut}
    />
  );
  const title = (
    <>
      {viewSwitch}
      <ComparisonTitle item={item} comparison={comparison} comment={comment} />
    </>
  );

  return (
    <div ref={viewerRef} className={styles.viewer} tabIndex={-1} onKeyDown={leave}>
      {annotating ? (
        <AnnotationPane key={item.path} path={item.path} repository={item.repository} revision={revision ?? undefined} leading={viewSwitch} />
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
