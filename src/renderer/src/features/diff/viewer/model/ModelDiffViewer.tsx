// The model pane: a 3D preview of an added or deleted model, and for a changed one the image diff's ways of looking
// in 3D (onion skin with its blink, side by side, differences, swipe), with what changed as Unity will take it. The
// mode control lives in the diff header (`ModelModeSwitch`, where images show theirs). One camera draws every mode
// (`useModelCamera`), so switching keeps the framing; the "What changed" panel frames and lights up what a change is
// about, and so does a click on the model; the info strip narrates the figures a budget checks.

import { Box as BoxIcon } from 'lucide-react';
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { ContentSource, FileContent } from '@shared/domain/content';
import { useSpinDelay } from '../../../../lib/useSpinDelay';
import { EmptyState } from '../../../../ui/EmptyState';
import { CenteredSpinner, Spinner } from '../../../../ui/Spinner';
import { useDiffPreferences } from '../diffPreferencesStore';
import { BlendPill } from '../image/BlendPill';
import { SideChip } from '../image/stage';
import { CENTERED_SPLIT, SwipeDivider } from '../image/SwipeDivider';
import { importSettingsChanges } from './importSettingsChanges';
import { ModelAnimationBar } from './ModelAnimationBar';
import { changeRows, type ChangeRow } from './modelChangeWords';
import { modelChanges, type NodeRef } from './modelChanges';
import { whatChanged } from './whatChanged';
import { ModelChangesPanel } from './ModelChangesPanel';
import { clipChoices } from './modelClips';
import { ModelDifferencesControls } from './ModelDifferencesControls';
import type { ModelDiffMode } from './modelDiffModes';
import { everyVersionHas, framedBounds, nodesBounds } from './modelFraming';
import type { ModelImportSettings } from './modelImportSettings';
import { ModelInfoStrip } from './ModelInfoStrip';
import { modelCommandOf } from './modelKeys';
import { aroundPoints, clickedNode, markersOf } from './modelPicking';
import { modelReadFailureWords } from './modelReadFailureWords';
import { useModelMaterials, type MaterialVersion } from './materials/useModelMaterials';
import { modelStats, movedStat, texturesStat } from './modelStats';
import { ModelViewControls } from './ModelViewControls';
import { matchNodes } from './nodeMatching';
import { centreOf } from './orbitCamera';
import { useModelCamera } from './useModelCamera';
import { useModelDifferences } from './useModelDifferences';
import { useModelPalette } from './useModelPalette';
import { useModelReadOptions } from './useModelReadOptions';
import { useModelRenderer } from './useModelRenderer';
import { useModelScene } from './useModelScene';
import { useFlyKeys } from './useFlyKeys';
import { useOrbitGestures } from './useOrbitGestures';
import { useReadModel, type ModelReadState } from './useReadModel';
import { useSize } from './useSize';
import { useStableModel } from './useStableModel';
import { diffsCompares, shownSurface } from './surfaceLook';
import { stagePillRows } from './stagePillRows';
import { texturesSettled } from './materials/materialPlan';
import { modelWorkspacePath } from './materials/modelWorkspacePath';
import { SiblingFinderContext, sourcePathOf, type DiffSide, type SiblingFinder } from './modelSiblings';
import { AssetsPointContext, type AssetsPointFinder } from './assetsPoints';
import styles from './ModelDiffViewer.module.css';

/** From this pane width the "What changed" panel opens as a column beside the stage. */
const ROOMY_PANE = 820;

interface ModelDiffViewerProps {
  workspacePath: string;
  /** Where each version was read from: the files a model needs beside it (a glTF's `.bin`, its `.meta`) are read beside it. */
  sources: { original: ContentSource; modified: ContentSource };
  original: FileContent;
  modified: FileContent;
  /** Active diff mode; owned by the header's segmented control. */
  mode: ModelDiffMode;
  /** Each version's import settings, when they're what is diffed (a `.meta`): otherwise read from the `.meta` beside it. */
  settings?: { original: ModelImportSettings; modified: ModelImportSettings };
}

/** What is lit up: a row of the panel (or one of its items), or a part clicked on the model. */
interface Picked {
  id: string;
  nodes: NodeRef[];
}

export function ModelDiffViewer({ workspacePath, sources, original, modified, mode, settings }: ModelDiffViewerProps) {
  const modelBefore = useStableModel(original.model);
  const modelAfter = useStableModel(modified.model);
  const optionsBefore = useModelReadOptions(workspacePath, 'original', sources.original, modelBefore, settings?.original);
  const optionsAfter = useModelReadOptions(workspacePath, 'modified', sources.modified, modelAfter, settings?.modified);
  const before = useReadModel(modelBefore, optionsBefore);
  const after = useReadModel(modelAfter, optionsAfter);
  const { modelDrawMode, setModelDrawMode, modelSurface, setModelSurface, modelToleranceShare, setModelToleranceShare, modelShowBones, setModelShowBones, modelChangesOpen, setModelChangesOpen } =
    useDiffPreferences();
  const paneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const palette = useModelPalette(paneRef);
  const { renderer, unavailable } = useModelRenderer(canvasHostRef);
  const paneWidth = useSize(paneRef).width;
  // Open, the panel docks beside the model where the pane has room for it, and floats over it where it hasn't.
  const changesOpen = modelChangesOpen;
  const docked = changesOpen && paneWidth >= ROOMY_PANE;
  // The onion blend and the swipe split live here, not in the renderer, so a trip through other modes comes back to them.
  const [blend, setBlend] = useState(0.5);
  const [split, setSplit] = useState(CENTERED_SPLIT);
  const [picked, setPicked] = useState<Picked | null>(null);

  const old = readyOf(before);
  const next = readyOf(after);
  const comparable = Boolean(original.model && modified.model);
  const sceneBefore = useModelScene(old);
  const sceneAfter = useModelScene(next);
  const differences = comparable && mode === 'differences';
  const findSibling = useContext(SiblingFinderContext);
  const findAssetsPoint = useContext(AssetsPointContext);
  const materialVersions = useMemo(
    () => ({
      before: materialVersionOf(old, modelBefore, optionsBefore, { side: 'original', source: sources.original, findSibling, findAssetsPoint }),
      after: materialVersionOf(next, modelAfter, optionsAfter, { side: 'modified', source: sources.modified, findSibling, findAssetsPoint }),
    }),
    [old, next, modelBefore, modelAfter, optionsBefore, optionsAfter, sources.original, sources.modified, findSibling, findAssetsPoint],
  );
  const materials = useModelMaterials(workspacePath, materialVersions, modelSurface === 'materials');
  const surface = shownSurface(modelSurface, materials.offered);
  const compares = diffsCompares(surface);
  const looksLoaded = texturesSettled(materials.report);
  const shapeDifferences = differences && compares === 'shape';
  const lookDifferences = differences && compares === 'look';
  const rows = useMemo(() => {
    if (!old || !next || !optionsBefore || !optionsAfter) return null;
    const gltf = old.model.format === 'gltf' || old.model.format === 'glb';
    return changeRows(
      whatChanged({
        file: modelChanges(old.summary, next.summary),
        importSettings: importSettingsChanges({ summary: old.summary, settings: optionsBefore.settings }, { summary: next.summary, settings: optionsAfter.settings }),
        settingsRead: optionsBefore.settingsFrom !== 'failed' && optionsAfter.settingsFrom !== 'failed',
        materials: materials.changes,
        materialsNotCompared: materials.notCompared,
        gltf,
      }),
    );
  }, [old, next, optionsBefore, optionsAfter, materials.changes, materials.notCompared]);
  const stats = useMemo(() => modelStats(old?.summary ?? null, next?.summary ?? null), [old, next]);
  // Every version there is, read: framing one alone would frame a pair whose other half may be 100 times its size.
  // On booleans: a pending file read again brings new bytes, not another pair.
  const [hasBefore, hasAfter] = [Boolean(original.model), Boolean(modified.model)];
  const present = useMemo(() => ({ before: hasBefore, after: hasAfter }), [hasBefore, hasAfter]);
  const allRead = everyVersionHas(present, { before: old, after: next });
  const bounds = useMemo(() => (allRead ? framedBounds(old?.summary ?? null, next?.summary ?? null) : null), [allRead, old, next]);

  // The camera frames only once every version is in the renderer (`everyVersionHas`): each scene is built a render
  // after its read, and framed with one missing, the renderer laid the other out alone, full width, and the pair kept
  // a framing made for that shape.
  const framing = everyVersionHas(present, { before: sceneBefore, after: sceneAfter }) ? bounds : null;
  const camera = useModelCamera(renderer, framing, stageRef);
  const modelCentre = useCallback(() => (bounds ? centreOf(bounds) : null), [bounds]);
  const pickedBounds = useCallback(
    (nodes: NodeRef[]) => nodesBounds(nodes, old?.summary ?? null, next?.summary ?? null) ?? aroundPoints(markersOf(nodes, sceneBefore, sceneAfter), bounds),
    [old, next, sceneBefore, sceneAfter, bounds],
  );
  const frameShown = useCallback(() => {
    const part = picked && pickedBounds(picked.nodes);
    if (part) camera.framePart(part);
    else camera.frameWhole();
  }, [camera, picked, pickedBounds]);

  useEffect(() => {
    if (!renderer || !bounds) return;
    renderer.setModels(sceneBefore, sceneAfter, bounds);
    // The pair framed once both scenes are in the renderer (`framing`), given here rather than left to the camera's
    // own effects, which may run after this one.
    camera.frameFirst(framing);
  }, [renderer, sceneBefore, sceneAfter, bounds, framing, camera]);
  useEffect(() => {
    if (renderer && palette) renderer.setPalette(palette);
  }, [renderer, palette]);
  useEffect(() => {
    renderer?.setLayout({ mode, blend, split });
  }, [renderer, mode, blend, split]);
  useEffect(() => {
    const highlighted = { before: new Set<string>(), after: new Set<string>() };
    for (const node of picked?.nodes ?? []) {
      if (node.before) highlighted.before.add(node.before);
      if (node.after) highlighted.after.add(node.after);
    }
    renderer?.setLook({ drawMode: modelDrawMode, surface, highlighted, diffsCompares: compares, looksLoaded });
    renderer?.setMarkers(markersOf(picked?.nodes ?? [], sceneBefore, sceneAfter));
  }, [renderer, picked, modelDrawMode, surface, compares, looksLoaded, sceneBefore, sceneAfter]);
  // After the scenes are set (`setModels` lets a replaced side's looks go), whenever either changes.
  useEffect(() => {
    if (renderer && bounds) renderer.setMaterialLooks(materials.looks);
  }, [renderer, bounds, materials.looks, sceneBefore, sceneAfter]);

  const { comparison, comparing, failed: comparisonFailed, tolerance, regions, currentRegion, stepRegion } = useModelDifferences({
    renderer,
    palette,
    before: old?.model ?? null,
    after: next?.model ?? null,
    wanted: shapeDifferences,
    toleranceShare: modelToleranceShare,
    frameRegion: camera.frameRegion,
  });
  const shownStats = useMemo(() => {
    const textures = surface === 'materials' && materials.report ? texturesStat(materials.report) : null;
    return [...stats, ...(shapeDifferences && comparison ? [movedStat(comparison, tolerance)] : []), ...(textures ? [textures] : [])];
  }, [shapeDifferences, comparison, stats, tolerance, surface, materials.report]);

  const choices = useMemo(() => clipChoices(old?.model.clips ?? [], next?.model.clips ?? []), [old, next]);
  const hasBones = (old?.summary.totals.bones ?? 0) + (next?.summary.totals.bones ?? 0) > 0;
  useEffect(() => {
    renderer?.setShowBones(hasBones && modelShowBones);
  }, [renderer, hasBones, modelShowBones]);
  const scenes = useMemo(() => ({ before: sceneBefore, after: sceneAfter }), [sceneBefore, sceneAfter]);

  const matching = useMemo(() => old && next && matchNodes(old.summary, next.summary), [old, next]);
  const onClick = useCallback(
    (x: number, y: number) => {
      const hit = renderer?.pick(x, y);
      if (!hit?.key) return setPicked(null);
      setPicked({ id: `node:${hit.side}:${hit.key}`, nodes: [clickedNode(hit.side, hit.key, old?.summary ?? null, next?.summary ?? null, matching)] });
    },
    [renderer, old, next, matching],
  );
  const stopCoasting = useOrbitGestures({ element: stageRef, renderer, view: camera.currentView, onView: camera.onGesture, onDollyStep: camera.onDollyStep, modelCentre, onClick });
  useEffect(() => camera.setInterrupt(stopCoasting), [camera, stopCoasting]);

  const onPickRow = useCallback(
    (id: string | null, row: ChangeRow, item?: number) => {
      if (id === null) return setPicked(null);
      const nodes = item === undefined ? row.focus : (row.items?.[item]?.focus ?? []);
      setPicked({ id, nodes });
      const target = pickedBounds(nodes);
      if (target) camera.framePart(target);
    },
    [camera, pickedBounds],
  );

  const flyKeys = useFlyKeys({ view: camera.currentView, onView: camera.onGesture, modelCentre });
  const onKeyDown = (event: KeyboardEvent): void => {
    // Only the stage's own: the arrows of a control in it (the take's scrubber, the panel's rows) stay the control's.
    if (event.target === event.currentTarget && flyKeys.onKeyDown(event)) {
      event.preventDefault();
      return;
    }
    const command = modelCommandOf(event.nativeEvent);
    if (!command) return;
    event.preventDefault();
    if (command === 'frameAll') camera.frameWhole();
    else frameShown();
  };

  const failed = [before, after].find((state): state is Extract<ModelReadState, { status: 'failed' }> => state.status === 'failed');
  const loading = !failed && [before, after].some((state) => state.status === 'loading');
  const spin = useSpinDelay(loading);
  const shownMode = comparable ? mode : null;

  const changesPanel = rows && (
    <ModelChangesPanel rows={rows} picked={picked?.id ?? null} onPick={onPickRow} open={changesOpen} onOpenChange={setModelChangesOpen} docked={docked} pillRows={stagePillRows({ mode: shownMode, diffsCompares: compares, regionCount: regions.length, looksLoaded })} />
  );

  if (failed) {
    const words = modelReadFailureWords(failed.failure);
    return <EmptyState icon={<BoxIcon size={22} />} title={words.title} description={words.description} />;
  }
  if (unavailable) {
    return <EmptyState icon={<BoxIcon size={22} />} title="Couldn't start the 3D view" description="This computer's graphics didn't let the app draw the model. Its file still shows in Code." />;
  }

  return (
    <div className={styles.pane} ref={paneRef} tabIndex={0} onKeyDown={onKeyDown} onKeyUp={flyKeys.onKeyUp} onBlur={flyKeys.onBlur}>
      <div className={styles.stage} ref={stageRef} data-mode={shownMode ?? 'single'}>
        <div ref={canvasHostRef} className={styles.canvasHost} role="img" aria-label="3D view of the model" />
        {loading && spin && <CenteredSpinner />}
        {!loading && (
          <>
            {shownMode === 'sideBySide' && (
              <>
                <div className={styles.splitLine} />
                <SideChip side="old" />
                <div className={styles.rightHalf}>
                  <SideChip side="new" />
                </div>
              </>
            )}
            {shownMode === 'swipe' && (
              <>
                <SwipeDivider split={split} onSplitChange={setSplit} container={stageRef} />
                <SideChip side="old" />
                <div className={styles.afterDivider} style={{ left: `${split * 100}%` }}>
                  <SideChip side="new" />
                </div>
              </>
            )}
            {shownMode === 'onion' && <BlendPill blend={blend} onBlendChange={setBlend} things="models" />}
            {shapeDifferences && comparison && (
              <ModelDifferencesControls
                toleranceShare={modelToleranceShare}
                onToleranceShare={setModelToleranceShare}
                modelSize={comparison.size}
                regionCount={regions.length}
                currentRegion={currentRegion}
                onStep={stepRegion}
              />
            )}
            {shapeDifferences && comparing && (
              <div className={styles.computing}>
                <Spinner size={14} /> Comparing surfaces…
              </div>
            )}
            {shapeDifferences && comparisonFailed && <div className={styles.computing}>Couldn't compare these surfaces</div>}
            {lookDifferences && !looksLoaded && (
              <div className={styles.computing}>
                <Spinner size={14} /> Loading textures to compare…
              </div>
            )}
            {rows && paneWidth > 0 && !docked && changesPanel}
            <ModelViewControls
              drawMode={modelDrawMode}
              onDrawMode={setModelDrawMode}
              surface={surface}
              onSurface={setModelSurface}
              materialsOffered={materials.offered}
              differences={differences}
              bones={hasBones ? { shown: modelShowBones, onShow: setModelShowBones } : null}
              onFrame={frameShown}
            />
            <div className={styles.dock}>
              {renderer && choices.length > 0 && <ModelAnimationBar renderer={renderer} scenes={scenes} choices={choices} comparable={comparable} />}
              <ModelInfoStrip stats={shownStats} />
            </div>
          </>
        )}
      </div>
      {rows && !loading && docked && changesPanel}
    </div>
  );
}

/** Where a side's version is: what it was read from, and how the view finds what goes with it. */
interface VersionPlace {
  side: DiffSide;
  source: ContentSource;
  findSibling: SiblingFinder;
  findAssetsPoint: AssetsPointFinder;
}

/** A version as the Materials look reads it: where it is in the workspace and at what point, its bytes and what it was read with. */
function materialVersionOf(
  read: Extract<ModelReadState, { status: 'ready' }> | null,
  bytes: FileContent['model'],
  options: ReturnType<typeof useModelReadOptions>,
  { side, source, findSibling, findAssetsPoint }: VersionPlace,
): MaterialVersion | null {
  if (!read || !bytes || !options) return null;
  const path = sourcePathOf(source);
  const sibling = (fileName: string) => (path === null ? null : findSibling(side, source, path, fileName));
  return { model: read.model, bytes, options, path: modelWorkspacePath(source), point: findAssetsPoint(side, source), sibling };
}

function readyOf(state: ModelReadState): Extract<ModelReadState, { status: 'ready' }> | null {
  return state.status === 'ready' ? state : null;
}
