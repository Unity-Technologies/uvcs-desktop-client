// The model pane: a 3D preview of an added or deleted model, and for a changed one the image diff's ways of looking
// in 3D (side by side, onion skin with its blink, swipe), with what changed as Unity will take it. The mode control
// lives in the diff header (`ModelModeSwitch`, where images show theirs). One camera draws every mode, so switching
// keeps the framing; the "What changed" panel frames and lights up what a change is about, and so does a click on
// the model; the info strip narrates the figures a budget checks.

import { Box as BoxIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { FileContent } from '@shared/domain/content';
import { useSpinDelay } from '../../../../lib/useSpinDelay';
import { EmptyState } from '../../../../ui/EmptyState';
import { CenteredSpinner } from '../../../../ui/Spinner';
import { useDiffPreferences } from '../diffPreferencesStore';
import { BlendPill } from '../image/BlendPill';
import { SideChip } from '../image/stage';
import { CENTERED_SPLIT, SwipeDivider } from '../image/SwipeDivider';
import { changeRows, type ChangeRow } from './modelChangeWords';
import { modelChanges, type NodeRef } from './modelChanges';
import { ModelChangesPanel } from './ModelChangesPanel';
import type { ModelDiffMode } from './modelDiffModes';
import { framedBounds, nodesBounds } from './modelFraming';
import { ModelInfoStrip } from './ModelInfoStrip';
import { modelCommandOf } from './modelKeys';
import { modelReadFailureWords } from './modelReadFailureWords';
import { buildModelScene, pivotOf, type ModelScene } from './modelScene';
import { modelStats } from './modelStats';
import type { ModelSummary } from './modelSummary';
import { ModelViewControls } from './ModelViewControls';
import { matchNodes } from './nodeMatching';
import { framedView, type BoundsLike, type OrbitView, type Vector } from './orbitCamera';
import { useModelPalette } from './useModelPalette';
import { useModelRenderer } from './useModelRenderer';
import { useOrbitGestures } from './useOrbitGestures';
import { useReadModel, type ModelReadState } from './useReadModel';
import styles from './ModelDiffViewer.module.css';

/** From this pane width the "What changed" panel opens as a column beside the stage. */
const ROOMY_PANE = 820;

interface ModelDiffViewerProps {
  original: FileContent;
  modified: FileContent;
  /** Active diff mode; owned by the header's segmented control. */
  mode: ModelDiffMode;
}

/** What is lit up: a row of the panel (or one of its items), or a part clicked on the model. */
interface Picked {
  id: string;
  nodes: NodeRef[];
}

export function ModelDiffViewer({ original, modified, mode }: ModelDiffViewerProps) {
  const before = useReadModel(original.model);
  const after = useReadModel(modified.model);
  const { modelDrawMode, setModelDrawMode, modelColorBySlot, setModelColorBySlot } = useDiffPreferences();
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
  const sceneBefore = useScene(old);
  const sceneAfter = useScene(next);
  const rows = useMemo(() => (old && next ? changeRows(modelChanges(old.summary, next.summary)) : null), [old, next]);
  const stats = useMemo(() => modelStats(old?.summary ?? null, next?.summary ?? null), [old, next]);
  // Every version there is, read: framing one alone would frame a pair whose other half may be 100 times its size.
  const allRead = (!original.model || old !== null) && (!modified.model || next !== null);
  const bounds = useMemo(() => (allRead ? framedBounds(old?.summary ?? null, next?.summary ?? null) : null), [allRead, old, next]);

  // The camera: a ref, not state, so a drag redraws the canvas without rendering the panel again. Until the hand
  // moves it, the app keeps the model framed: as the stage is resized, and as the panel docks beside it.
  const view = useRef<OrbitView | null>(null);
  const framedByApp = useRef(true);
  const setView = useCallback(
    (next: OrbitView) => {
      view.current = next;
      renderer?.setView(next);
    },
    [renderer],
  );
  const onGesture = useCallback(
    (next: OrbitView) => {
      framedByApp.current = false;
      setView(next);
    },
    [setView],
  );
  const frame = useCallback(
    (target: BoundsLike | null) => {
      if (!renderer || !target) return;
      const current = view.current;
      setView(current ? framedView(target, renderer.paneAspect(), current.yaw, current.pitch) : framedView(target, renderer.paneAspect()));
    },
    [renderer, setView],
  );
  const pickedBounds = useCallback(
    (nodes: NodeRef[]) => nodesBounds(nodes, old?.summary ?? null, next?.summary ?? null) ?? aroundPoints(markersOf(nodes, sceneBefore, sceneAfter), bounds),
    [old, next, sceneBefore, sceneAfter, bounds],
  );
  const frameShown = useCallback(() => frame((picked && pickedBounds(picked.nodes)) ?? bounds), [frame, picked, pickedBounds, bounds]);

  useEffect(() => {
    if (!renderer || !bounds) return;
    renderer.setModels(sceneBefore, sceneAfter, bounds);
    // A new pair is framed whole from the first view; the same pair read again (an edit typed) keeps the camera.
    if (!view.current) frame(bounds);
  }, [renderer, sceneBefore, sceneAfter, bounds, frame]);
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

  const matching = useMemo(() => old && next && matchNodes(old.summary, next.summary), [old, next]);
  const onClick = useCallback(
    (x: number, y: number) => {
      const hit = renderer?.pick(x, y);
      if (!hit?.key) return setPicked(null);
      setPicked({ id: `node:${hit.side}:${hit.key}`, nodes: [clickedNode(hit.side, hit.key, old?.summary ?? null, next?.summary ?? null, matching)] });
    },
    [renderer, old, next, matching],
  );
  useOrbitGestures({ element: stageRef, renderer, view: () => view.current ?? framedView({ min: [-1, -1, -1], max: [1, 1, 1] }, 1), onView: onGesture, onClick });
  const stageSize = useSize(stageRef);
  useEffect(() => {
    if (framedByApp.current && view.current) frame(bounds);
  }, [stageSize, frame, bounds]);

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
    <ModelChangesPanel rows={rows} picked={picked?.id ?? null} onPick={onPickRow} open={changesOpen} onOpenChange={setPanelOpen} docked={docked} belowPill={shownMode === 'onion'} />
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
            {rows && paneWidth > 0 && !docked && changesPanel}
            <ModelViewControls drawMode={modelDrawMode} onDrawMode={setModelDrawMode} colorBySlot={modelColorBySlot} onColorBySlot={setModelColorBySlot} onFrame={frameShown} />
            <ModelInfoStrip stats={stats} />
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

/** The version's three.js scene, built once per version read and let go with it. */
function useScene(read: Extract<ModelReadState, { status: 'ready' }> | null): ModelScene | null {
  const scene = useMemo(() => read && buildModelScene(read.model, read.summary), [read]);
  useEffect(() => () => scene?.dispose(), [scene]);
  return scene;
}

/** A part clicked on one side, with the node it is on the other side, so both light up. */
function clickedNode(side: 'before' | 'after', key: string, before: ModelSummary | null, after: ModelSummary | null, matching: ReturnType<typeof matchNodes> | null): NodeRef {
  const own = side === 'before' ? before : after;
  const index = own?.nodes.findIndex((node) => node.key === key) ?? -1;
  const node = own?.nodes[index];
  const other = matching && index >= 0 ? (side === 'before' ? matching.afterOf[index] : matching.beforeOf[index]) : -1;
  const otherKey = other !== undefined && other >= 0 ? (side === 'before' ? after : before)?.nodes[other]?.key : undefined;
  return {
    name: node?.name ?? key,
    path: node?.path ?? key,
    kind: node?.kind ?? 'mesh',
    ...(side === 'before' ? { before: key, ...(otherKey !== undefined && { after: otherKey }) } : { after: key, ...(otherKey !== undefined && { before: otherKey }) }),
  };
}

/** Where the picked nodes that draw nothing (bones, empties) are on each side: their pivots, marked as dots. */
function markersOf(nodes: NodeRef[], before: ModelScene | null, after: ModelScene | null): Record<'before' | 'after', Vector[]> {
  const pivots = (scene: ModelScene | null, keys: (string | undefined)[]): Vector[] =>
    keys.flatMap((key) => {
      const pivot = key === undefined || !scene || scene.meshes.some((mesh) => mesh.key === key) ? null : pivotOf(scene, key);
      return pivot ? [pivot.toArray() as Vector] : [];
    });
  return { before: pivots(before, nodes.map((node) => node.before)), after: pivots(after, nodes.map((node) => node.after)) };
}

/** A box around points with a third of the model around them, so a bone framed shows the part of the model it moves. */
function aroundPoints(markers: Record<'before' | 'after', Vector[]>, model: BoundsLike | null): BoundsLike | null {
  const points = [...markers.before, ...markers.after];
  if (points.length === 0 || !model) return null;
  const pad = Math.max(...model.max.map((value, axis) => value - model.min[axis]!)) * 0.3;
  const min = [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis]!)) - pad) as Vector;
  const max = [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis]!)) + pad) as Vector;
  return { min, max };
}

/** The element's size, followed as it is resized; 0 × 0 until measured. */
function useSize(ref: React.RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry?.contentRect.width ?? 0, height: entry?.contentRect.height ?? 0 }));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
