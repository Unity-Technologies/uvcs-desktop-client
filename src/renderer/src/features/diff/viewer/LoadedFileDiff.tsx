import { AppWindow, Columns2, EyeOff, FileText, FoldVertical, RefreshCw, Rows2, WrapText } from 'lucide-react';
import { Suspense, useMemo, type ReactNode, type RefObject } from 'react';
import type { FileContent } from '@shared/domain/content';
import { api } from '../../../api/client';
import { formatSize } from '../../../lib/formatDate';
import { lazyComponent } from '../../../lib/lazyComponent';
import { hotkey } from '../../../lib/shortcutRegistry';
import { useShortcut } from '../../../lib/useShortcut';
import { Button } from '../../../ui/Button';
import { EmptyState } from '../../../ui/EmptyState';
import { IconButton } from '../../../ui/IconButton';
import { PaneToolbarGroup } from '../../../ui/PaneToolbar';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { CenteredSpinner } from '../../../ui/Spinner';
import { absolutePath } from '../../pendingChanges/pendingChangeOperations';
import { canDiscardChanges } from './canDiscardChanges';
import { canEditInPlace } from './canEditInPlace';
import { comparisonMethodLabel, type ComparisonMethod } from './comparisonMethod';
import { ComparisonMethodMenu } from './ComparisonMethodMenu';
import { diffPresentation } from './diffPresentation';
import { useDiffPreferences, type DiffLayout } from './diffPreferencesStore';
import { DiffNotice } from './DiffNotice';
import { DiffViewerFrame } from './DiffViewerFrame';
import { discardInFile, undoLastDiscard, type DiscardTarget } from './discardInFile';
import type { EditorHandle } from './editorHandle';
import { IMAGE_DIFF_MODES, type ImageDiffMode } from './image/imageDiffModes';
import { IGNORED_DIFFERENCE_TITLES, ignoredDifference } from './ignoredDifference';
import { hasLineChanges, lineChangeStats } from './lineChangeStats';
import { LineStats } from './LineStats';
import type { DiscardRequest } from './useBlockDiscard';
import type { DiffContents } from './useDiffContents';
import { useFileBuffer } from './useFileBuffer';

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

/**
 * One loaded pair of file versions, with the toolbar that fits how it's shown. A workspace file shown against its own
 * past is typed into directly, like in any editor: Discard and Save show up as soon as it has unsaved edits.
 */
export function LoadedFileDiff({ workspacePath, contents, fileName, title, identicalDescription, compareControls, onMatchesBase }: LoadedFileDiffProps) {
  const { layout, collapseUnchanged, wrapLines, comparisonMethod, imageMode, setLayout, setCollapseUnchanged, setWrapLines, setComparisonMethod, setImageMode } =
    useDiffPreferences();
  const editablePath = canEditInPlace(contents.original, contents.modified) ? contents.modified.path : null;
  const buffer = useFileBuffer({ workspacePath, contents, path: editablePath, onMatchesBase });
  const { left, right, original, modified } = buffer.shown;
  const current = buffer.unsaved ?? right.text ?? '';
  const dirty = buffer.unsaved !== null;

  const presentation = diffPresentation(left, right);
  const isText = presentation.kind === 'text';
  const editable = isText && editablePath !== null;
  const shownStats = useMemo(
    () => (isText ? lineChangeStats(left.text ?? '', right.text ?? '', comparisonMethod) : null),
    [isText, left.text, right.text, comparisonMethod],
  );
  // The header counts what the diff shows now, unsaved edits included.
  const stats = useMemo(
    () => (isText ? (current === right.text ? shownStats : lineChangeStats(left.text ?? '', current, comparisonMethod)) : null),
    [isText, left.text, right.text, current, comparisonMethod, shownStats],
  );
  // Different texts the comparison method shows as equal, e.g. only their line endings changed.
  const onlyIgnoredChanges = presentation.kind === 'text' && !presentation.identical && shownStats !== null && !hasLineChanges(shownStats);
  const openFile = editablePath === null ? undefined : () => void api.system.openPath(absolutePath(workspacePath, editablePath));

  useShortcut(hotkey('saveFile'), () => void buffer.save(), dirty);
  useShortcut(hotkey('editFile'), () => buffer.editor.current?.focus(), editable);

  const discardTarget: DiscardTarget | null = canDiscardChanges(original, modified)
    ? { workspacePath, path: modified.path, baseText: original.kind === 'workspaceBase' ? (left.text ?? '') : null, onMatchesBase }
    : null;
  // With unsaved edits, a discard is one more edit: it stays unsaved and ⌘Z takes it back like typing.
  const onDiscard = discardTarget
    ? ({ text, done }: DiscardRequest) =>
        dirty ? buffer.editor.current?.setText(text) : void discardInFile(discardTarget, { before: current, after: text }, done)
    : undefined;
  const onUndoDiscard = discardTarget ? () => (dirty ? buffer.editor.current?.undo() : void undoLastDiscard(discardTarget)) : undefined;

  const unsavedControls = dirty && (
    <PaneToolbarGroup>
      <Button size="small" variant="ghost" data-tip="Go back to the file on disk" onClick={buffer.discard}>
        Discard
      </Button>
      <Button size="small" variant="primary" data-tip="Save the file" data-tip-shortcut={hotkey('saveFile')} onClick={() => void buffer.save()}>
        Save
      </Button>
    </PaneToolbarGroup>
  );

  const controls = isText ? (
    <>
      {compareControls}
      {stats && hasLineChanges(stats) && <LineStats {...stats} />}
      <PaneToolbarGroup>
        <ComparisonMethodMenu value={comparisonMethod} onChange={setComparisonMethod} />
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
      {unsavedControls}
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

  const recognizeAll = <Button size="small" onClick={() => setComparisonMethod('recognizeAll')}>Recognize all</Button>;
  const textDiff = (
    <TextDiffBody
      original={left.text}
      modified={right.text}
      current={current}
      fileName={fileName}
      comparisonMethod={comparisonMethod}
      editable={editable}
      editorRef={buffer.editor}
      onEdit={buffer.onEdit}
      onDiscard={onDiscard}
      onUndoDiscard={onUndoDiscard}
    />
  );

  let body: ReactNode;
  if (editable) {
    // Typed into even with no lines to show: then the whole file, under a line that says why.
    const note =
      dirty ? null
      : presentation.empty ? <DiffNotice tone="info" icon={<FileText size={13} />}>Empty file. Type to add to it.</DiffNotice>
      : presentation.identical ? <DiffNotice tone="info" icon={<FileText size={13} />}>No content changes. {identicalDescription ?? 'The contents of both versions are identical.'}</DiffNotice>
      : onlyIgnoredChanges ? (
        <DiffNotice tone="info" icon={<EyeOff size={13} />} action={recognizeAll}>
          {IGNORED_DIFFERENCE_TITLES[ignoredDifference(left.text ?? '', right.text ?? '')]}. The comparison method, {comparisonMethodLabel(comparisonMethod)}, hides these changes.
        </DiffNotice>
      )
      : null;
    body = (
      <>
        {buffer.changedOnDisk && (
          <DiffNotice tone="attention" icon={<RefreshCw size={13} />} action={<Button size="small" onClick={buffer.discard}>Reload</Button>}>
            File changed on disk. Reload to see the new version; your unsaved edits are discarded.
          </DiffNotice>
        )}
        {note}
        {textDiff}
      </>
    );
  } else if (presentation.kind === 'text' && presentation.empty) {
    body = <EmptyState icon={<FileText size={22} />} title="Empty file" description="This file has no content." />;
  } else if (presentation.kind === 'text' && presentation.identical) {
    body = <EmptyState title="No content changes" description={identicalDescription ?? 'The contents of both versions are identical.'} />;
  } else if (onlyIgnoredChanges) {
    body = (
      <EmptyState
        title={IGNORED_DIFFERENCE_TITLES[ignoredDifference(left.text ?? '', right.text ?? '')]}
        description={`The comparison method, ${comparisonMethodLabel(comparisonMethod)}, hides these changes.`}
        action={<Button onClick={() => setComparisonMethod('recognizeAll')}>Recognize all</Button>}
      />
    );
  } else if (presentation.kind === 'text') {
    body = textDiff;
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
  current: string;
  fileName: string;
  comparisonMethod: ComparisonMethod;
  editable: boolean;
  editorRef: RefObject<EditorHandle | null>;
  onEdit: (text: string) => void;
  onDiscard?: (request: DiscardRequest) => void;
  onUndoDiscard?: () => void;
}

function TextDiffBody({ original, modified, ...rest }: TextDiffBodyProps) {
  return (
    <Suspense fallback={<CenteredSpinner />}>
      <TextDiff original={original ?? ''} modified={modified ?? ''} {...rest} />
    </Suspense>
  );
}

function sizeChange(left: FileContent, right: FileContent): string {
  return `${formatSize(left.size)} → ${formatSize(right.size)}`;
}
