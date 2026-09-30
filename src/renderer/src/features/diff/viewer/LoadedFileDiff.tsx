import { RefreshCw } from 'lucide-react';
import { Suspense, useMemo, useRef, type ReactNode } from 'react';
import { api } from '../../../api/client';
import { lazyComponent } from '../../../lib/lazyComponent';
import { hotkey } from '../../../lib/shortcutRegistry';
import { useShortcut } from '../../../lib/useShortcut';
import { Button } from '../../../ui/Button';
import { CenteredSpinner } from '../../../ui/Spinner';
import { absolutePath, extensionOf } from '../../pendingChanges/pendingChangeOperations';
import { canEditInPlace } from './canEditInPlace';
import { ChangeNavigator } from './ChangeNavigator';
import type { ChangeView } from './changeView';
import { diffBodyOf } from './diffBody';
import { diffDiscards } from './diffDiscards';
import { diffPresentation, hasTwoRepresentations, showsLines } from './diffPresentation';
import { useDiffPreferences } from './diffPreferencesStore';
import { DiffNotice } from './DiffNotice';
import { DiffViewerFrame } from './DiffViewerFrame';
import { ImageModeSwitch } from './ImageModeSwitch';
import { hasLineChanges } from './lineDiff';
import { MethodHidingNotice } from './MethodHidingNotice';
import { NothingToDiff } from './NothingToDiff';
import { renderedEdits } from './renderedEdits';
import { RepresentationSwitch } from './RepresentationSwitch';
import { followsLayout } from './shownDiff';
import { syntaxHighlighting } from './syntaxHighlighting';
import { TextViewControls } from './TextViewControls';
import { UnsavedEditsControls } from './UnsavedEditsControls';
import { goesSomewhere, useChangeNavigation } from './useChangeNavigation';
import type { DiffContents } from './useDiffContents';
import { useFileBuffer } from './useFileBuffer';
import { useLineDiffs } from './useLineDiffs';
import { typedIntoWhole, wholeFileNote } from './wholeFileNote';
import { WholeFileNotice } from './WholeFileNotice';

// The diff renderer (Pierre + Shiki) is large; load it with the first diff instead of at startup.
const TextDiff = lazyComponent(() => import('./TextDiff').then((module) => module.TextDiff));
// So is the image viewer, and most sessions never open an image.
const ImageDiffViewer = lazyComponent(() => import('./image/ImageDiffViewer').then((module) => module.ImageDiffViewer));

const IDENTICAL_DESCRIPTION = 'The contents of both versions are identical.';

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
  const { comparisonMethod, imageMode, representations, setComparisonMethod, setRepresentation } = useDiffPreferences();
  const editablePath = canEditInPlace(contents.original, contents.modified) ? contents.modified.path : null;
  const sides = useMemo(
    () => ({ original: contents.original.kind !== 'empty', modified: contents.modified.kind !== 'empty' }),
    [contents.original.kind, contents.modified.kind],
  );
  const buffer = useFileBuffer({ workspacePath, contents, path: editablePath, onMatchesBase });
  const { left, right } = buffer.shown;
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
  const diffs = useLineDiffs({ isText, original: left.text ?? '', saved: right.text, current, comparisonMethod, fileName });
  const wholeFile = typedIntoWhole(editable, diffs.saved);
  // Nothing to view differently in an empty or unchanged file that only says so.
  const viewControls = showsLines(presentation, editable);
  // Nor to move through there or in a file typed into whole; a version shown alone (added, deleted) is one change.
  // Beside a list of files, every diff keeps the arrows, to go on to the next file whatever this one is.
  const frame = useRef<HTMLDivElement>(null);
  const changeView = useRef<ChangeView>(null);
  const navigation = useChangeNavigation(viewControls && !wholeFile ? (diffs.current?.meta ?? null) : null, changeView, frame, fileName);
  const navigator = goesSomewhere(navigation) && <ChangeNavigator navigation={navigation} />;
  const openFile = editablePath === null ? undefined : () => void api.system.openPath(absolutePath(workspacePath, editablePath));
  const discards = diffDiscards(workspacePath, buffer, onMatchesBase);
  const identical = identicalDescription ?? IDENTICAL_DESCRIPTION;
  const recognizeAll = (): void => setComparisonMethod('recognizeAll');

  useShortcut(hotkey('saveFile'), () => void buffer.save(), dirty);
  useShortcut(hotkey('editFile'), () => buffer.editor.current?.focus(), editable);

  const representationSwitch = twoRepresentations && <RepresentationSwitch value={representation} onChange={(value) => setRepresentation(extension, value)} />;
  // Discard and Save come first: the controls are right-aligned, so appearing on the first keystroke they move none
  // of the others. The change arrows come last, at the header's right edge, in the same place for every file (a
  // version shown alone has no Split | Unified): clicking on through the files, the pointer stays on them.
  const controls = (
    <>
      {dirty && <UnsavedEditsControls buffer={buffer} />}
      {isText && compareControls}
      {viewControls && (
        <TextViewControls
          diff={diffs.current}
          plainText={syntaxHighlighting(left.text ?? '', right.text ?? '', editable) === 'off'}
          followsLayout={followsLayout(sides, wholeFile)}
        />
      )}
      {/* Single-sided images (added or deleted) are previews: no modes to offer. */}
      {presentation.kind === 'image' && presentation.comparable && <ImageModeSwitch />}
      {representationSwitch}
      {navigator}
    </>
  );

  const textDiff = diffs.current && (
    <Suspense fallback={<CenteredSpinner />}>
      <TextDiff
        original={left.text ?? ''}
        modified={right.text ?? ''}
        current={current}
        diff={diffs.current}
        diffedText={diffs.diffedText}
        wholeFile={wholeFile}
        fileName={fileName}
        comparisonMethod={comparisonMethod}
        sides={sides}
        editable={editable}
        editorRef={buffer.editor}
        onEdit={buffer.onEdit}
        onDiscard={discards?.onDiscard}
        onUndoDiscard={discards?.onUndoDiscard}
        changeViewRef={changeView}
        onViewScroll={navigation.onViewScroll}
      />
    </Suspense>
  );
  // Of the file as read, so the line saying so stays put while it's typed into.
  const hidingNotice = diffs.hidingMethod && (
    <MethodHidingNotice method={diffs.hidingMethod} original={left.text ?? ''} modified={right.text ?? ''} onPick={setComparisonMethod} />
  );

  let body: ReactNode;
  const bodyKind = diffBodyOf(presentation, editable, diffs.saved);
  switch (bodyKind) {
    case 'editable': {
      // Typed into even with no lines to show: then the whole file, under a line that says why.
      const note =
        wholeFile && presentation.kind === 'text'
          ? wholeFileNote({ empty: presentation.empty, identical: presentation.identical, dirty, unsavedLineChanges: diffs.current !== null && hasLineChanges(diffs.current) })
          : null;
      body = (
        <>
          {buffer.changedOnDisk && (
            <DiffNotice tone="attention" icon={<RefreshCw size={13} />} action={<Button size="small" onClick={buffer.discard}>Reload</Button>}>
              File changed on disk. Reload to take the new version and drop your edits, or save yours over it.
            </DiffNotice>
          )}
          {hidingNotice}
          {note && (
            <WholeFileNotice
              note={note}
              identicalDescription={identical}
              texts={{ original: left.text ?? '', current }}
              comparisonMethod={comparisonMethod}
              onRecognizeAll={recognizeAll}
            />
          )}
          {textDiff}
        </>
      );
      break;
    }
    case 'textDiff':
      body = (
        <>
          {hidingNotice}
          {textDiff}
        </>
      );
      break;
    case 'image':
      body = (
        <Suspense fallback={<CenteredSpinner />}>
          <ImageDiffViewer original={left} modified={shownImage} mode={imageMode} />
        </Suspense>
      );
      break;
    default:
      body = (
        <NothingToDiff
          reason={bodyKind}
          left={left}
          right={right}
          identicalDescription={identical}
          comparisonMethod={comparisonMethod}
          onRecognizeAll={recognizeAll}
          openFile={openFile}
        />
      );
  }

  return (
    <DiffViewerFrame ref={frame} title={title} controls={controls}>
      {body}
    </DiffViewerFrame>
  );
}
