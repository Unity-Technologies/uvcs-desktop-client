import { AppWindow, ArchiveX, PencilOff, RefreshCw } from 'lucide-react';
import { Suspense, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Place } from '@shared/domain/place';
import { openFile } from '../../../components/externalApps/externalAppOperations';
import { lazyComponent } from '../../../lib/lazyComponent';
import { hotkey } from '../../../lib/shortcutRegistry';
import { useShortcut } from '../../../lib/useShortcut';
import { useTypingPause } from './useTypingPause';
import { Button } from '../../../ui/Button';
import { CenteredSpinner } from '../../../ui/Spinner';
import { absolutePath } from '../../pendingChanges/pendingChangeOperations';
import { extensionOf } from '../../../lib/text';
import { editedFileIn, typesIntoDiff } from './canEditInPlace';
import { DiffFrameHostContext, type DiffFrameHost } from './diffFrameHost';
import type { ChangeView } from './changeView';
import { diffBodyOf, stepsCanCome } from './diffBody';
import { diffDiscards } from './diffDiscards';
import { diffPresentation, hasTwoRepresentations, renderedRepresentation, showsLines } from './diffPresentation';
import { useDiffPreferences } from './diffPreferencesStore';
import { DiffNotice } from './DiffNotice';
import { ImageModeSwitch } from './ImageModeSwitch';
import { hasLineChanges } from './lineDiff';
import { hasLineTooLongToDraw } from './longLines';
import { MethodHidingNotice } from './MethodHidingNotice';
import { modelBesideMeta, modelOfMeta } from './model/modelMeta';
import { SiblingFinderContext } from './model/modelSiblings';
import { ModelModeSwitch } from './ModelModeSwitch';
import { NothingToDiff } from './NothingToDiff';
import { diffSidesOf, purgedNotice, purgedVersionsOf } from './purgedVersions';
import { renderedEdits } from './renderedEdits';
import { RepresentationSwitch } from './RepresentationSwitch';
import { followsLayout } from './shownDiff';
import { plainTextThresholdLabel, syntaxHighlighting } from './syntaxHighlighting';
import { TextViewControls } from './TextViewControls';
import { UnsavedEditsControls } from './UnsavedEditsControls';
import { useChangeNavigation } from './useChangeNavigation';
import type { DiffContents } from './useDiffContents';
import { useFileBuffer } from './useFileBuffer';
import { useLineDiffs } from './useLineDiffs';
import { typedIntoWhole, wholeFileNote } from './wholeFileNote';
import { WholeFileNotice } from './WholeFileNotice';

// The diff renderer (Pierre + Shiki) is large; load it with the first diff instead of at startup.
const TextDiff = lazyComponent(() => import('./TextDiff').then((module) => module.TextDiff));
// So is the image viewer, and most sessions never open an image.
const ImageDiffViewer = lazyComponent(() => import('./image/ImageDiffViewer').then((module) => module.ImageDiffViewer));
// And the model viewer, with three.js, the largest of the three; a model's .meta shows through it too.
const ModelDiffViewer = lazyComponent(() => import('./model/ModelDiffViewer').then((module) => module.ModelDiffViewer));
const ModelMetaDiff = lazyComponent(() => import('./model/ModelMetaDiff').then((module) => module.ModelMetaDiff));

const IDENTICAL_DESCRIPTION = 'The contents of both versions are identical.';

interface LoadedFileDiffProps {
  place: Place;
  contents: DiffContents;
  fileName: string;
  identicalDescription?: string;
  /** Controls about what to compare, in the toolbar of every diff (a binary file, an image or a model has its `.meta` too), right before the change arrows. */
  compareControls?: ReactNode;
  /** Discarding changes brought the workspace file back to its loaded revision. */
  onMatchesBase?: () => void;
  /** Steps through its changes with the header's arrows and keys (`useChangeNavigation`); off where a view around it steps. */
  stepsThroughChanges?: boolean;
}

/**
 * One loaded pair of file versions, with the toolbar that fits how it's shown. A workspace file shown against its own
 * past is typed into directly, like in any editor: Discard and Save show up as soon as it has unsaved edits.
 */
export function LoadedFileDiff({ place, contents, fileName, identicalDescription, compareControls, onMatchesBase, stepsThroughChanges = true }: LoadedFileDiffProps) {
  const { comparisonMethod, imageMode, modelMode, representations, setComparisonMethod, setRepresentation } = useDiffPreferences();
  const editedFile = editedFileIn(place, contents.original, contents.modified);
  const editableInPlace = editedFile !== null;
  // A purged version shows as a missing one does: the other alone, under a line saying why (`purgedNotice`).
  const purged = purgedVersionsOf(contents.left, contents.right);
  const sides = useMemo(() => diffSidesOf(contents.original, contents.modified, purged), [contents.original, contents.modified, purged]);
  const buffer = useFileBuffer({ contents, file: editedFile, onMatchesBase });
  const { left, right } = buffer.shown;
  const current = buffer.unsaved ?? right.text ?? '';
  const dirty = buffer.unsaved !== null;
  // One image or model per pause in typing: a new one is encoded, and painted from a new blob URL or parsed anew.
  const pausedText = useTypingPause(current);
  const shownRendering = useMemo(() => (dirty ? renderedEdits(right, pausedText) : right), [dirty, right, pausedText]);

  // Files that are text and render at once (SVG, OBJ) show rendered unless the user picked the text for their type.
  const twoRepresentations = hasTwoRepresentations(left, right);
  const rendered = renderedRepresentation(left, right) ?? 'image';
  const extension = extensionOf(fileName)?.toLowerCase() ?? '';
  const representation = representations[extension] ?? rendered;
  const presentation = diffPresentation(left, right, representation);
  const isText = presentation.kind === 'text';
  // A model's .meta shows as the model under its import settings where the model can be found beside it, unless the
  // user picked its text (`representations.meta`).
  const findSibling = useContext(SiblingFinderContext);
  // Where neither side's model was beside it after all (in History, a .meta moved since: `metaModelView`), the .meta is
  // its text, as any other, arrows and notices included; told by ModelMetaDiff once read, for these versions only.
  const metaVersions = JSON.stringify([contents.original, contents.modified]);
  const [modelAbsentFor, setModelAbsentFor] = useState<string | null>(null);
  const modelFound = modelAbsentFor !== metaVersions;
  const metaModel = isText && modelFound && modelOfMeta(fileName) !== null ? modelBesideMeta(findSibling, { original: contents.original, modified: contents.modified }) : null;
  const metaAsModel = metaModel !== null && (representations.meta ?? 'model') === 'model';
  const wrapsLongLines = useMemo(() => isText && hasLineTooLongToDraw([left.text ?? '', right.text ?? '']), [isText, left.text, right.text]);
  const editable = useMemo(() => isText && typesIntoDiff(editableInPlace, [left.text ?? '', right.text ?? '']), [isText, editableInPlace, left.text, right.text]);
  // A workspace file shown read-only all the same says why, with the way to edit it elsewhere.
  const tooLongToType = isText && editableInPlace && !editable;
  const diffs = useLineDiffs({ isText, original: left.text ?? '', saved: right.text, current, comparisonMethod, fileName });
  const wholeFile = typedIntoWhole(editable, diffs.saved);
  // Nothing to view differently in an empty or unchanged file that only says so, nor in a .meta shown as its model.
  const viewControls = !metaAsModel && showsLines(presentation, editable);
  const bodyKind = metaAsModel ? 'metaModel' : diffBodyOf(presentation, editable, diffs.saved);
  // Nor to move through there or in a file typed into whole; a version shown alone (added, deleted) is one change.
  // Beside a list of files, every diff keeps the arrows, to go on to the next file whatever this one is.
  // The header and its arrows are the frame's around it (`SteppedDiffFrame`), which outlives this diff: it hands them
  // its navigation each time it renders, saying whose it is, and draws its controls into the header.
  const host = useDiffFrameHost();
  const ownKey = metaVersions;
  const changeView = useRef<ChangeView>(null);
  const stepsCome = stepsCanCome(bodyKind, { wholeFile, stepsThroughChanges });
  const steppedDiff = stepsCome ? (diffs.current?.meta ?? null) : null;
  // Presses made before it opened (the header's, while it was read, then its own) wait in the frame's queue, for it.
  const kept = useMemo(() => ({ push: (direction: 1 | -1) => host.queue.push(ownKey, direction), take: () => host.queue.take(ownKey) }), [host.queue, ownKey]);
  const navigation = useChangeNavigation(steppedDiff, changeView, host.frame, fileName, { active: ownKey === host.requestedKey, noStepsComing: !stepsCome, kept });
  const stepsOwn = steppedDiff !== null;
  useLayoutEffect(() => host.publish({ navigation, stepsOwn, key: ownKey }));
  useLayoutEffect(() => () => host.publish(null), [host.publish]);
  const openEditable = editedFile === null ? undefined : () => void openFile(absolutePath(editedFile.workspacePath, editedFile.path));
  const discards = diffDiscards(place, buffer, onMatchesBase);
  const identical = identicalDescription ?? IDENTICAL_DESCRIPTION;
  const recognizeAll = (): void => setComparisonMethod('recognizeAll');

  useShortcut(hotkey('saveFile'), () => void buffer.save(), dirty);
  useShortcut(hotkey('editFile'), () => buffer.editor.current?.focus(), editable);

  const representationSwitch = twoRepresentations && (
    <RepresentationSwitch value={representation === 'text' ? 'text' : rendered} rendered={rendered} onChange={(value) => setRepresentation(extension, value)} />
  );
  // Discard and Save come first: the controls are right-aligned, so appearing on the first keystroke they move none
  // of the others. The change arrows aren't controls: the frame draws them last, at the header's right edge, in the
  // same place for every file (`DiffViewerFrame`). The compare controls (`.meta`, Since review) come last of these, so
  // they stay put too whatever controls a file has (a text file's, an image's or a binary file's none): toggling a
  // binary file's `.meta` leaves the button under the pointer.
  const controls = (
    <>
      {dirty && <UnsavedEditsControls buffer={buffer} />}
      {viewControls && (
        <TextViewControls
          diff={diffs.current}
          plainText={syntaxHighlighting(left.text ?? '', right.text ?? '', editable) === 'off'}
          plainTextThreshold={plainTextThresholdLabel(editable)}
          followsLayout={followsLayout(sides, wholeFile)}
          wrapsLongLines={wrapsLongLines}
        />
      )}
      {/* Single-sided images and models (added or deleted) are previews: no modes to offer. */}
      {presentation.kind === 'image' && presentation.comparable && <ImageModeSwitch />}
      {presentation.kind === 'model' && presentation.comparable && <ModelModeSwitch />}
      {metaAsModel && <ModelModeSwitch />}
      {representationSwitch}
      {metaModel !== null && <RepresentationSwitch value={metaAsModel ? 'model' : 'text'} rendered="model" onChange={(value) => setRepresentation('meta', value)} />}
      {compareControls}
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
        wrapsLongLines={wrapsLongLines}
      />
    </Suspense>
  );
  // Of the file as read, so the line saying so stays put while it's typed into.
  const hidingNotice = diffs.hidingMethod && (
    <MethodHidingNotice method={diffs.hidingMethod} original={left.text ?? ''} modified={right.text ?? ''} onPick={setComparisonMethod} />
  );
  // Above whatever a workspace file shown read-only all the same shows: its diff, or the line saying there's none.
  const tooLongNotice = tooLongToType && (
    <DiffNotice tone="info" icon={<PencilOff size={13} />} action={openEditable && <Button size="small" icon={<AppWindow size={13} />} onClick={openEditable}>Open file</Button>}>
      A line of this file is too long to edit here.
    </DiffNotice>
  );

  let body: ReactNode;
  switch (bodyKind) {
    case 'metaModel':
      body = (
        <Suspense fallback={<CenteredSpinner />}>
          <ModelMetaDiff
            place={place}
            sources={{ original: contents.original, modified: contents.modified }}
            texts={{ original: sides.original ? (left.text ?? '') : null, modified: sides.modified ? (dirty ? pausedText : (right.text ?? '')) : null }}
            mode={modelMode}
            onModelAbsent={() => setModelAbsentFor(metaVersions)}
          />
        </Suspense>
      );
      break;
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
          {tooLongNotice}
          {hidingNotice}
          {textDiff}
        </>
      );
      break;
    case 'image':
      body = (
        <Suspense fallback={<CenteredSpinner />}>
          <ImageDiffViewer original={left} modified={shownRendering} mode={imageMode} openFile={openEditable} />
        </Suspense>
      );
      break;
    case 'model':
      body = (
        <Suspense fallback={<CenteredSpinner />}>
          <ModelDiffViewer
            place={place}
            sources={{ original: contents.original, modified: contents.modified }}
            original={left}
            modified={shownRendering}
            mode={modelMode}
          />
        </Suspense>
      );
      break;
    default:
      body = (
        <>
          {tooLongNotice}
          <NothingToDiff
            reason={bodyKind}
            left={left}
            right={right}
            identicalDescription={identical}
            comparisonMethod={comparisonMethod}
            onRecognizeAll={recognizeAll}
            openFile={openEditable}
          />
        </>
      );
  }

  const purgedLine = purgedNotice(purged);
  return (
    <>
      {host.controls && createPortal(controls, host.controls)}
      {purgedLine && (
        <DiffNotice tone="info" icon={<ArchiveX size={13} />}>
          {purgedLine}
        </DiffNotice>
      )}
      {body}
    </>
  );
}

/** The header this diff draws into; a diff is always drawn in one (`SteppedDiffFrame`). */
function useDiffFrameHost(): DiffFrameHost {
  const host = useContext(DiffFrameHostContext);
  if (!host) throw new Error('LoadedFileDiff is drawn inside a SteppedDiffFrame');
  return host;
}
