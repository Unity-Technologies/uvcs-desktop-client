import { AppWindow, Code, Columns2, EyeOff, FileText, FoldVertical, ImageIcon, Pilcrow, RefreshCw, Rows2, WrapText } from 'lucide-react';
import { Suspense, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { followsLayout, type DiffSides } from './shownDiff';
import type { FileContent } from '@shared/domain/content';
import { api } from '../../../api/client';
import { formatSize } from '../../../lib/formatDate';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import { lazyComponent } from '../../../lib/lazyComponent';
import { hotkey } from '../../../lib/shortcutRegistry';
import { useShortcut } from '../../../lib/useShortcut';
import { Button } from '../../../ui/Button';
import { EmptyState } from '../../../ui/EmptyState';
import { IconButton } from '../../../ui/IconButton';
import { PaneToolbarGroup } from '../../../ui/PaneToolbar';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { CenteredSpinner } from '../../../ui/Spinner';
import { absolutePath, extensionOf } from '../../pendingChanges/pendingChangeOperations';
import { canDiscardChanges } from './canDiscardChanges';
import { canEditInPlace } from './canEditInPlace';
import { ChangeNavigator } from './ChangeNavigator';
import type { ChangeView } from './changeView';
import { comparisonMethodLabel, type ComparisonMethod } from './comparisonMethod';
import { ComparisonMethodMenu } from './ComparisonMethodMenu';
import { diffPresentation, hasTwoRepresentations, showsLines, type Representation } from './diffPresentation';
import { useDiffPreferences, type DiffLayout } from './diffPreferencesStore';
import { DiffNotice } from './DiffNotice';
import { diffsEveryKeystroke, TYPING_PAUSE_MS } from './diffWhileTyping';
import { DiffViewerFrame } from './DiffViewerFrame';
import { discardInFile, undoLastDiscard, type DiscardTarget } from './discardInFile';
import type { EditorHandle } from './editorHandle';
import { IMAGE_DIFF_MODES, type ImageDiffMode } from './image/imageDiffModes';
import { IGNORED_DIFFERENCE_TITLES, ignoredDifference, methodHidingEveryChange } from './ignoredDifference';
import { hasLineChanges, lineDiff, type LineDiff } from './lineDiff';
import { LineStats } from './LineStats';
import { PlainTextIndicator } from './PlainTextIndicator';
import { syntaxHighlighting } from './syntaxHighlighting';
import type { DiscardRequest } from './useBlockDiscard';
import type { DiffContents } from './useDiffContents';
import { renderedEdits } from './renderedEdits';
import { goesSomewhere, useChangeNavigation } from './useChangeNavigation';
import { useFileBuffer } from './useFileBuffer';
import { typedIntoWhole, wholeFileNote } from './wholeFileNote';

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
  const {
    layout,
    collapseUnchanged,
    wrapLines,
    comparisonMethod,
    imageMode,
    representations,
    setLayout,
    setCollapseUnchanged,
    setWrapLines,
    setComparisonMethod,
    setImageMode,
    setRepresentation,
  } = useDiffPreferences();
  const editablePath = canEditInPlace(contents.original, contents.modified) ? contents.modified.path : null;
  const sides = useMemo(
    () => ({ original: contents.original.kind !== 'empty', modified: contents.modified.kind !== 'empty' }),
    [contents.original.kind, contents.modified.kind],
  );
  const buffer = useFileBuffer({ workspacePath, contents, path: editablePath, onMatchesBase });
  const { left, right, original, modified } = buffer.shown;
  const current = buffer.unsaved ?? right.text ?? '';
  const dirty = buffer.unsaved !== null;
  // One image per state of the text: a new one is encoded, and painted from a new blob URL.
  const shownImage = useMemo(() => (dirty ? renderedEdits(right, current) : right), [dirty, right, current]);

  // Files that are text and an image at once (SVG) show rendered unless the user picked the text for their type.
  const twoRepresentations = hasTwoRepresentations(left, right);
  const extension = extensionOf(fileName)?.toLowerCase() ?? '';
  const representation = representations[extension] ?? 'image';
  const presentation = diffPresentation(left, right, representation);
  const isText = presentation.kind === 'text';
  const editable = isText && editablePath !== null;
  // The one diff of the texts under the comparison method (`lineDiff`): of the file as read, and as it is now with
  // unsaved edits. The header counts the latter, and the diff shows and discards from it. A big text typed into is
  // diffed again once typing pauses (`diffedText`), not at every keystroke.
  const savedDiff = useMemo(
    () => (isText ? lineDiff(left.text ?? '', right.text ?? '', comparisonMethod, fileName) : null),
    [isText, left.text, right.text, comparisonMethod, fileName],
  );
  const pausedText = useDebouncedValue(current, TYPING_PAUSE_MS);
  const diffedText = current === right.text || diffsEveryKeystroke(left.text ?? '', current) ? current : pausedText;
  const currentDiff = useMemo(
    () => (isText && diffedText !== right.text ? lineDiff(left.text ?? '', diffedText, comparisonMethod, fileName) : savedDiff),
    [isText, left.text, right.text, diffedText, comparisonMethod, fileName, savedDiff],
  );
  // Typed into whole when the file as read shows no lines: nothing changed, it's empty, or only ignored differences.
  const wholeFile = typedIntoWhole(editable, savedDiff);
  // Different texts the comparison method shows as equal, e.g. only their line endings changed.
  const onlyIgnoredChanges = presentation.kind === 'text' && !presentation.identical && savedDiff !== null && !hasLineChanges(savedDiff);
  // The other way round: changes that are all what another method ignores, e.g. every line ending changed. Of the file
  // as read, so the line saying so stays put while it's typed into.
  const hidingMethod = useMemo(
    () => (savedDiff && hasLineChanges(savedDiff) ? methodHidingEveryChange(left.text ?? '', right.text ?? '', comparisonMethod) : null),
    [savedDiff, left.text, right.text, comparisonMethod],
  );
  // Nothing to view differently in an empty or unchanged file that only says so.
  const viewControls = showsLines(presentation, editable);
  // Nor to move through there or in a file typed into whole; a version shown alone (added, deleted) is one change.
  // Beside a list of files, every diff keeps the arrows, to go on to the next file whatever this one is.
  const frame = useRef<HTMLDivElement>(null);
  const changeView = useRef<ChangeView>(null);
  const navigation = useChangeNavigation(viewControls && !wholeFile ? (currentDiff?.meta ?? null) : null, changeView, frame, fileName);
  const navigator = goesSomewhere(navigation) && <ChangeNavigator navigation={navigation} />;
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
      <Button size="small" variant="primary" data-tip={buffer.changedOnDisk ? "Save your version over the one on disk" : "Save the file"} data-tip-shortcut={hotkey('saveFile')} onClick={() => void buffer.save()}>
        Save
      </Button>
    </PaneToolbarGroup>
  );

  const representationControl = twoRepresentations && (
    <SegmentedControl<Representation>
      value={representation}
      onChange={(value) => setRepresentation(extension, value)}
      segments={[
        { value: 'text', label: <><Code size={13} /> <span data-toolbar-label>Code</span></>, title: 'Compare the text' },
        { value: 'image', label: <><ImageIcon size={13} /> <span data-toolbar-label>Image</span></>, title: 'Compare the rendered images' },
      ]}
    />
  );

  // Said in the header, not over the diff: a note there would stack on "No content changes".
  const plainText = isText && syntaxHighlighting(left.text ?? '', right.text ?? '', editable) === 'off';

  // Discard and Save come first: the controls are right-aligned, so appearing on the first keystroke they move none
  // of the others. The change arrows come last, at the header's right edge, in the same place for every file (a
  // version shown alone has no Split | Unified): clicking on through the files, the pointer stays on them.
  const controls = isText ? (
    <>
      {unsavedControls}
      {compareControls}
      {viewControls && (
        <>
          {plainText && <PlainTextIndicator />}
          {currentDiff && hasLineChanges(currentDiff) && <LineStats added={currentDiff.added} removed={currentDiff.removed} />}
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
          {followsLayout(sides, wholeFile) && (
            <SegmentedControl<DiffLayout>
              value={layout}
              onChange={setLayout}
              segments={[
                { value: 'split', label: <><Columns2 size={13} /> <span data-toolbar-label>Split</span></>, title: 'Side-by-side view' },
                { value: 'unified', label: <><Rows2 size={13} /> <span data-toolbar-label>Unified</span></>, title: 'Unified view' },
              ]}
            />
          )}
        </>
      )}
      {representationControl}
      {navigator}
    </>
  ) : (
    <>
      {unsavedControls}
      {/* Single-sided images (added or deleted) are previews: no modes to offer. */}
      {presentation.kind === 'image' && presentation.comparable && (
        <SegmentedControl<ImageDiffMode>
          value={imageMode}
          onChange={setImageMode}
          segments={IMAGE_DIFF_MODES.map((mode) => ({ value: mode.value, label: <>{mode.icon} <span data-toolbar-label>{mode.label}</span></>, title: mode.title ?? mode.label }))}
        />
      )}
      {representationControl}
      {navigator}
    </>
  );

  const recognizeAll = <Button size="small" onClick={() => setComparisonMethod('recognizeAll')}>Recognize all</Button>;
  const textDiff = currentDiff && (
    <TextDiffBody
      original={left.text}
      modified={right.text}
      current={current}
      diff={currentDiff}
      diffedText={diffedText}
      wholeFile={wholeFile}
      fileName={fileName}
      comparisonMethod={comparisonMethod}
      sides={sides}
      editable={editable}
      editorRef={buffer.editor}
      onEdit={buffer.onEdit}
      onDiscard={onDiscard}
      onUndoDiscard={onUndoDiscard}
      changeViewRef={changeView}
      onViewScroll={navigation.onViewScroll}
    />
  );

  const hidingNote = hidingMethod && (
    <DiffNotice tone="info" icon={<Pilcrow size={13} />} action={<Button size="small" onClick={() => setComparisonMethod(hidingMethod)}>{comparisonMethodLabel(hidingMethod)}</Button>}>
      {IGNORED_DIFFERENCE_TITLES[ignoredDifference(left.text ?? '', right.text ?? '')]}.
    </DiffNotice>
  );

  let body: ReactNode;
  if (editable) {
    // Typed into even with no lines to show: then the whole file, under a line that says why.
    const noteKind =
      wholeFile && presentation.kind === 'text'
        ? wholeFileNote({ empty: presentation.empty, identical: presentation.identical, dirty, unsavedLineChanges: currentDiff !== null && hasLineChanges(currentDiff) })
        : null;
    const note =
      noteKind === 'empty' ? <DiffNotice tone="info" icon={<FileText size={13} />}>Empty file. Type to add to it.</DiffNotice>
      : noteKind === 'identical' ? <DiffNotice tone="info" icon={<FileText size={13} />}>No content changes. {identicalDescription ?? 'The contents of both versions are identical.'}</DiffNotice>
      : noteKind === 'unsaved' ? <DiffNotice tone="info" icon={<FileText size={13} />}>Your edits show as a diff once saved.</DiffNotice>
      : noteKind === 'ignored' ? (
        <DiffNotice tone="info" icon={<EyeOff size={13} />} action={recognizeAll}>
          {IGNORED_DIFFERENCE_TITLES[ignoredDifference(left.text ?? '', current)]}. The comparison method, {comparisonMethodLabel(comparisonMethod)}, hides these changes.
        </DiffNotice>
      )
      : null;
    body = (
      <>
        {buffer.changedOnDisk && (
          <DiffNotice tone="attention" icon={<RefreshCw size={13} />} action={<Button size="small" onClick={buffer.discard}>Reload</Button>}>
            File changed on disk. Reload to take the new version and drop your edits, or save yours over it.
          </DiffNotice>
        )}
        {hidingNote}
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
    body = (
      <>
        {hidingNote}
        {textDiff}
      </>
    );
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
        <ImageDiffViewer original={left} modified={shownImage} mode={imageMode} />
      </Suspense>
    );
  } else {
    body = <EmptyState title="Binary file" description={`${sizeChange(left, right)}. Binary contents can't be compared as text.`} />;
  }

  return (
    <DiffViewerFrame ref={frame} title={title} controls={controls}>
      {body}
    </DiffViewerFrame>
  );
}

interface TextDiffBodyProps {
  original?: string;
  modified?: string;
  current: string;
  diff: LineDiff;
  diffedText: string;
  wholeFile: boolean;
  fileName: string;
  comparisonMethod: ComparisonMethod;
  sides: DiffSides;
  editable: boolean;
  editorRef: RefObject<EditorHandle | null>;
  onEdit: (text: string) => void;
  onDiscard?: (request: DiscardRequest) => void;
  onUndoDiscard?: () => void;
  changeViewRef: RefObject<ChangeView | null>;
  onViewScroll: () => void;
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
