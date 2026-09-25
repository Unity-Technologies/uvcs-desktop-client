import { AppWindow, Columns2, FileText, FoldVertical, Pencil, Rows2, WrapText } from 'lucide-react';
import { Suspense, useMemo, useState, type ReactNode } from 'react';
import type { FileContent } from '@shared/domain/content';
import { api } from '../../../api/client';
import { formatSize } from '../../../lib/formatDate';
import { lazyComponent } from '../../../lib/lazyComponent';
import { useShortcut } from '../../../lib/useShortcut';
import { Button } from '../../../ui/Button';
import { EmptyState } from '../../../ui/EmptyState';
import { IconButton } from '../../../ui/IconButton';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { CenteredSpinner } from '../../../ui/Spinner';
import { absolutePath } from '../../pendingChanges/pendingChangeOperations';
import { canDiscardChanges } from './canDiscardChanges';
import { diffPresentation } from './diffPresentation';
import { useDiffPreferences, type DiffLayout } from './diffPreferencesStore';
import { PaneToolbarGroup } from '../../../ui/PaneToolbar';
import { DiffViewerFrame } from './DiffViewerFrame';
import { discardInFile, undoLastDiscard, type DiscardTarget } from './discardInFile';
import { FileChangedNotice } from './FileChangedNotice';
import { IMAGE_DIFF_MODES, type ImageDiffMode } from './image/imageDiffModes';
import { lineChangeStats } from './lineChangeStats';
import { LineStats } from './LineStats';
import type { DiscardRequest } from './useBlockDiscard';
import type { DiffContents } from './useDiffContents';
import { useFileEditing } from './useFileEditing';
import { hotkey } from '../../../lib/shortcutRegistry';

// The diff renderer (Pierre + Shiki) is large; load it with the first diff instead of at startup.
const TextDiff = lazyComponent(() => import('./TextDiff').then((module) => module.TextDiff));
// So is the image viewer, and most sessions never open an image.
const ImageDiffViewer = lazyComponent(() => import('./image/ImageDiffViewer').then((module) => module.ImageDiffViewer));

interface LoadedFileDiffProps {
  workspacePath: string;
  contents: DiffContents;
  fileName: string;
  title?: ReactNode;
  identicalDescription?: string;
  /** Controls about what to compare, first in the toolbar of a text diff. */
  compareControls?: ReactNode;
  /** Discarding changes brought the workspace file back to its loaded revision. */
  onMatchesBase?: () => void;
}

/** One loaded pair of file versions, with the toolbar that fits how it's shown. */
export function LoadedFileDiff({ workspacePath, contents, fileName, title, identicalDescription, compareControls, onMatchesBase }: LoadedFileDiffProps) {
  const { layout, collapseUnchanged, wrapLines, imageMode, setLayout, setCollapseUnchanged, setWrapLines, setImageMode } = useDiffPreferences();
  const editablePath = contents.modified.kind === 'workspaceFile' ? contents.modified.path : null;
  const editing = useFileEditing(workspacePath, editablePath);
  // The file follows the disk, except while it's being edited: then it stays as it was when editing started.
  const [editedFrom, setEditedFrom] = useState(contents);
  const { left, right, original, modified } = editing.editing ? editedFrom : contents;
  const changedOnDisk = editing.editing && contents.right.text !== editedFrom.right.text && contents.right.text !== editing.draft;
  const startEditing = (): void => {
    setEditedFrom(contents);
    editing.start();
  };

  const presentation = diffPresentation(left, right);
  const isText = presentation.kind === 'text';
  const canEdit = isText && editablePath !== null;
  const stats = useMemo(() => (isText ? lineChangeStats(left.text ?? '', right.text ?? '') : null), [isText, left.text, right.text]);
  const openFile = editablePath === null ? undefined : () => void api.system.openPath(absolutePath(workspacePath, editablePath));

  useShortcut(hotkey('saveFile'), () => void editing.save(), editing.editing);
  useShortcut(hotkey('editFile'), startEditing, canEdit && !editing.editing);

  const discardTarget: DiscardTarget | null = canDiscardChanges(original, modified)
    ? { workspacePath, path: modified.path, baseText: original.kind === 'workspaceBase' ? (left.text ?? '') : null, onMatchesBase }
    : null;
  const onDiscard = discardTarget ? ({ text, done }: DiscardRequest) => void discardInFile(discardTarget, { before: right.text ?? '', after: text }, done) : undefined;
  const onUndoDiscard = discardTarget ? () => void undoLastDiscard(discardTarget) : undefined;

  const editAction = canEdit && (
    <Button icon={<Pencil size={13} />} onClick={startEditing}>
      Edit file
    </Button>
  );

  const controls = editing.editing ? (
    <PaneToolbarGroup>
      <Button size="small" variant="ghost" onClick={editing.discard}>
        {editing.dirty ? 'Discard edits' : 'Done'}
      </Button>
      <Button size="small" variant="primary" disabled={!editing.dirty} onClick={() => void editing.save()}>
        Save
      </Button>
    </PaneToolbarGroup>
  ) : isText ? (
    <>
      {compareControls}
      {stats && (stats.added > 0 || stats.removed > 0) && <LineStats {...stats} />}
      <PaneToolbarGroup>
        {canEdit && <IconButton size="small" icon={<Pencil size={13} />} label="Edit this file" shortcut={hotkey('editFile')} onClick={startEditing} />}
        <IconButton
          size="small"
          icon={<FoldVertical size={14} />}
          label={collapseUnchanged ? 'Show all lines' : 'Collapse unchanged lines'}
          variant={collapseUnchanged ? 'secondary' : 'ghost'}
          onClick={() => setCollapseUnchanged(!collapseUnchanged)}
        />
        <IconButton
          size="small"
          icon={<WrapText size={14} />}
          label={wrapLines ? "Don't wrap lines" : 'Wrap lines'}
          variant={wrapLines ? 'secondary' : 'ghost'}
          onClick={() => setWrapLines(!wrapLines)}
        />
      </PaneToolbarGroup>
      <SegmentedControl<DiffLayout>
        value={layout}
        onChange={setLayout}
        segments={[
          { value: 'split', label: <><Columns2 size={13} /> Split</>, title: 'Side-by-side view' },
          { value: 'unified', label: <><Rows2 size={13} /> Unified</>, title: 'Unified view' },
        ]}
      />
    </>
  ) : (
    // Single-sided images (added or deleted) are previews: no modes to offer.
    presentation.kind === 'image' &&
    presentation.comparable && (
      <SegmentedControl<ImageDiffMode>
        value={imageMode}
        onChange={setImageMode}
        segments={IMAGE_DIFF_MODES.map((mode) => ({ value: mode.value, label: <>{mode.icon} {mode.label}</>, title: mode.title }))}
      />
    )
  );

  let body: ReactNode;
  if (isText && editing.editing) {
    body = (
      <>
        {changedOnDisk && <FileChangedNotice onReload={editing.discard} />}
        <TextDiffBody original={left.text} modified={right.text} fileName={fileName} editing onEdit={editing.change} />
      </>
    );
  } else if (presentation.kind === 'text' && presentation.empty) {
    body = <EmptyState icon={<FileText size={22} />} title="Empty file" description="This file has no content." action={editAction} />;
  } else if (presentation.kind === 'text' && presentation.identical) {
    body = <EmptyState title="No content changes" description={identicalDescription ?? 'The contents of both versions are identical.'} action={editAction} />;
  } else if (presentation.kind === 'text') {
    body = <TextDiffBody original={left.text} modified={right.text} fileName={fileName} onDiscard={onDiscard} onUndoDiscard={onUndoDiscard} />;
  } else if (presentation.kind === 'tooLarge') {
    body = (
      <EmptyState
        title={presentation.content === 'image' ? 'This image is too large to preview' : 'This file is too large to show a diff'}
        description={sizeChange(left, right)}
        action={openFile && <Button icon={<AppWindow size={13} />} onClick={openFile}>Open file</Button>}
      />
    );
  } else if (presentation.kind === 'image') {
    body = (
      <Suspense fallback={<CenteredSpinner />}>
        <ImageDiffViewer original={left} modified={right} mode={imageMode} />
      </Suspense>
    );
  } else {
    body = <EmptyState title="Binary file" description={`${sizeChange(left, right)}. Binary contents can't be compared as text.`} />;
  }

  return (
    <DiffViewerFrame title={title} controls={controls}>
      {body}
    </DiffViewerFrame>
  );
}

interface TextDiffBodyProps {
  original?: string;
  modified?: string;
  fileName: string;
  editing?: boolean;
  onEdit?: (text: string) => void;
  onDiscard?: (request: DiscardRequest) => void;
  onUndoDiscard?: () => void;
}

function TextDiffBody({ original, modified, fileName, editing = false, onEdit = () => {}, onDiscard, onUndoDiscard }: TextDiffBodyProps) {
  return (
    <Suspense fallback={<CenteredSpinner />}>
      <TextDiff
        original={original ?? ''}
        modified={modified ?? ''}
        fileName={fileName}
        editing={editing}
        onEdit={onEdit}
        onDiscard={onDiscard}
        onUndoDiscard={onUndoDiscard}
      />
    </Suspense>
  );
}

function sizeChange(left: FileContent, right: FileContent): string {
  return `${formatSize(left.size)} → ${formatSize(right.size)}`;
}
