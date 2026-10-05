// The model pane: a 3D preview of an added or deleted model, and for a changed one the image diff's ways of looking
// in 3D (onion skin with its blink, side by side, differences, swipe), with what changed as Unity will take it. The
// mode control lives in the diff header (`ModelModeSwitch`, where images show theirs). One camera draws every mode
// (`useModelCamera`), so switching keeps the framing; the "What changed" panel frames and lights up what a change is
// about, and so does a click on the model; the info strip narrates the figures a budget checks.

import { Box as BoxIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
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
import { isRisk, modelChanges, type NodeRef } from './modelChanges';
import { ModelChangesPanel } from './ModelChangesPanel';
import { clipChoices } from './modelClips';
import { ModelDifferencesControls } from './ModelDifferencesControls';
import type { ModelDiffMode } from './modelDiffModes';
import { framedBounds, nodesBounds } from './modelFraming';
import type { ModelImportSettings } from './modelImportSettings';
import { ModelInfoStrip } from './ModelInfoStrip';
import { modelCommandOf } from './modelKeys';
import { aroundPoints, clickedNode, markersOf } from './modelPicking';
import { modelReadFailureWords } from './modelReadFailureWords';
import { modelStats, movedStat } from './modelStats';
import { ModelViewControls } from './ModelViewControls';
import { matchNodes } from './nodeMatching';
import { useModelCamera } from './useModelCamera';
import { useModelDifferences } from './useModelDifferences';
import { useModelPalette } from './useModelPalette';
import { useModelReadOptions } from './useModelReadOptions';
import { useModelRenderer } from './useModelRenderer';
import { useModelScene } from './useModelScene';
import { useOrbitGestures } from './useOrbitGestures';
import { useReadModel, type ModelReadState } from './useReadModel';
import { useSize } from './useSize';
import { useStableModel } from './useStableModel';
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
  const { modelDrawMode, setModelDrawMode, modelColorBySlot, setModelColorBySlot, modelToleranceShare, setModelToleranceShare, modelShowBones, setModelShowBones } =
    useDiffPreferences();
  const paneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const palette = useModelPalette(paneRef);
  const renderer = useModelRenderer(canvasRef);
  const paneWidth = useSize(paneRef).width;
  // The panel starts open where the pane has room for it beside the model, folded where it would cover much of it.
  const [panelOpen, setPanelOpen] = useState<boolean | null>(null);
  const changesOpen = panelOpen ?? paneWidth >= ROOMY_PANE;
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
  const rows = useMemo(() => {
    if (!old || !next || !optionsBefore || !optionsAfter) return null;
    const changes = [...modelChanges(old.summary, next.summary), ...importSettingsChanges({ summary: old.summary, settings: optionsBefore.settings }, { summary: next.summary, settings: optionsAfter.settings })];
    return changeRows([...changes.filter(isRisk), ...changes.filter((change) => !isRisk(change))]);
  }, [old, next, optionsBefore, optionsAfter]);
  const stats = useMemo(() => modelStats(old?.summary ?? null, next?.summary ?? null), [old, next]);
  // Every version there is, read: framing one alone would frame a pair whose other half may be 100 times its size.
  const allRead = (!original.model || old !== null) && (!modified.model || next !== null);
  const bounds = useMemo(() => (allRead ? framedBounds(old?.summary ?? null, next?.summary ?? null) : null), [allRead, old, next]);

  const camera = useModelCamera(renderer, bounds, stageRef);
  const { frame } = camera;
  const pickedBounds = useCallback(
    (nodes: NodeRef[]) => nodesBounds(nodes, old?.summary ?? null, next?.summary ?? null) ?? aroundPoints(markersOf(nodes, sceneBefore, sceneAfter), bounds),
    [old, next, sceneBefore, sceneAfter, bounds],
  );
  const frameShown = useCallback(() => frame((picked && pickedBounds(picked.nodes)) ?? bounds), [frame, picked, pickedBounds, bounds]);

  useEffect(() => {
    if (!renderer || !bounds) return;
    renderer.setModels(sceneBefore, sceneAfter, bounds);
    camera.frameFirst();
  }, [renderer, sceneBefore, sceneAfter, bounds, camera.frameFirst]);
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
    renderer?.setLook({ drawMode: modelDrawMode, colorBySlot: modelColorBySlot, highlighted });
    renderer?.setMarkers(markersOf(picked?.nodes ?? [], sceneBefore, sceneAfter));
  }, [renderer, picked, modelDrawMode, modelColorBySlot, sceneBefore, sceneAfter]);

  const differences = comparable && mode === 'differences';
  const { comparison, comparing, failed: comparisonFailed, tolerance, regions, currentRegion, stepRegion } = useModelDifferences({
    renderer,
    palette,
    before: old?.model ?? null,
    after: next?.model ?? null,
    wanted: differences,
    toleranceShare: modelToleranceShare,
    frame,
  });
  const shownStats = useMemo(() => (differences && comparison ? [...stats, movedStat(comparison, tolerance)] : stats), [differences, comparison, stats, tolerance]);

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
  useOrbitGestures({ element: stageRef, renderer, view: camera.currentView, onView: camera.onGesture, onClick });

  const onPickRow = useCallback(
    (id: string | null, row: ChangeRow, item?: number) => {
      if (id === null) return setPicked(null);
      const nodes = item === undefined ? row.focus : (row.items?.[item]?.focus ?? []);
      setPicked({ id, nodes });
      const target = pickedBounds(nodes);
      if (target) frame(target);
    },
    [frame, pickedBounds],
  );

  const onKeyDown = (event: KeyboardEvent): void => {
    const command = modelCommandOf(event.nativeEvent);
    if (!command) return;
    event.preventDefault();
    if (command === 'frameAll') frame(bounds);
    else frameShown();
  };

  const failed = [before, after].find((state): state is Extract<ModelReadState, { status: 'failed' }> => state.status === 'failed');
  const loading = !failed && [before, after].some((state) => state.status === 'loading');
  const spin = useSpinDelay(loading);
  const shownMode = comparable ? mode : null;

  const changesPanel = rows && (
    <ModelChangesPanel rows={rows} picked={picked?.id ?? null} onPick={onPickRow} open={changesOpen} onOpenChange={setPanelOpen} docked={docked} pillRows={shownMode === 'onion' ? 1 : differences ? (regions.length > 0 ? 2 : 1) : 0} />
  );

  if (failed) {
    const words = modelReadFailureWords(failed.failure);
    return <EmptyState icon={<BoxIcon size={22} />} title={words.title} description={words.description} />;
  }

  return (
    <div className={styles.pane} ref={paneRef} tabIndex={0} onKeyDown={onKeyDown}>
      <div className={styles.stage} ref={stageRef} data-mode={shownMode ?? 'single'}>
        <canvas ref={canvasRef} className={styles.canvas} aria-label="3D view of the model" />
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
            {differences && comparison && (
              <ModelDifferencesControls
                toleranceShare={modelToleranceShare}
                onToleranceShare={setModelToleranceShare}
                modelSize={comparison.size}
                regionCount={regions.length}
                currentRegion={currentRegion}
                onStep={stepRegion}
              />
            )}
            {differences && comparing && (
              <div className={styles.computing}>
                <Spinner size={14} /> Comparing surfaces…
              </div>
            )}
            {differences && comparisonFailed && <div className={styles.computing}>Couldn't compare these surfaces</div>}
            {rows && paneWidth > 0 && !docked && changesPanel}
            <ModelViewControls
              drawMode={modelDrawMode}
              onDrawMode={setModelDrawMode}
              colorBySlot={modelColorBySlot}
              onColorBySlot={setModelColorBySlot}
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

function readyOf(state: ModelReadState): Extract<ModelReadState, { status: 'ready' }> | null {
  return state.status === 'ready' ? state : null;
}
