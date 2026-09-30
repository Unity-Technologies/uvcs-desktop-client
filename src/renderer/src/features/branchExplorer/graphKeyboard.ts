import type { KeyboardEvent, RefObject } from 'react';
import { spec } from '@shared/domain/specs';
import { hotkey, hotkeys, type ShortcutId } from '../../lib/shortcutRegistry';
import { matchesShortcut } from '../../lib/shortcuts';
import { isTextEntry } from '../../lib/textEntry';
import type { GraphCanvasHandle } from './canvas/graphCanvasHandle';
import { ZOOM_STEP } from './canvas/zoom';
import { graphActions, openSelection } from './graphActions';
import type { GraphSelection } from './graphSelection';
import { selectedLabel } from './model/graphLabels';
import { movedSelection, selectedBranchOf, type GraphMove } from './model/keyboardMoves';
import type { GraphLayout } from './model/layoutGraph';
import type { GraphDirection } from './model/navigateGraph';

const ARROW_DIRECTIONS: Record<string, GraphDirection> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

/** What the keys read and move. */
export interface GraphKeyboard {
  layout: GraphLayout | null;
  selection: GraphSelection | null;
  select: (selection: GraphSelection | null) => void;
  homeChangeset: number | null;
  repository: string;
  canvas: RefObject<GraphCanvasHandle | null>;
  goHome: () => void;
  find: () => void;
  fit: () => void;
  zoomBy: (factor: number) => void;
  toggleDetails: () => void;
  /** Esc with nothing selected: out of the focus on a branch. */
  exitFocus: () => void;
}

/** The Branch Explorer's `graph*` shortcuts, pressed anywhere in the view but in its fields, buttons and menus. */
export function handleGraphKey(event: KeyboardEvent, keyboard: GraphKeyboard): void {
  // Keys pressed in a context or details menu (a portal) bubble here too: they belong to the menu.
  if (!event.currentTarget.contains(event.target as Node)) return;
  if (!keyboard.layout || ownsKey(event.target, event.key)) return;
  const binding = graphKeyBindings(keyboard, keyboard.layout, event).find(([id]) => isPressed(id, event));
  if (!binding) return;
  event.preventDefault();
  binding[1]();
}

function graphKeyBindings(keyboard: GraphKeyboard, layout: GraphLayout, event: KeyboardEvent): [ShortcutId, () => void][] {
  const { selection, select, homeChangeset, repository, canvas, goHome } = keyboard;
  const selectedId = selection?.kind === 'changeset' ? selection.id : null;
  const branchName = selectedBranchOf(layout, selection);
  const lane = branchName !== null ? layout.lanesByBranch.get(branchName) : undefined;

  // Keyboard moves glide the view along, just enough to keep the selection in sight.
  const move = (graphMove: GraphMove): void => {
    const stop = movedSelection(layout, selection, homeChangeset, graphMove);
    if (stop === null) return;
    select(stop);
    canvas.current?.follow(stop);
  };
  const branchEdge = (edge: 'first' | 'last'): void => {
    // With nothing selected, Home keeps its old meaning: the workspace changeset.
    if (branchName === null && edge === 'first') goHome();
    else move({ kind: 'branchEdge', edge });
  };
  // A page keeps a column of the last screen in sight.
  const page = (step: 1 | -1): void => move({ kind: 'page', step, columns: Math.max(1, (canvas.current?.columnsOnScreen() ?? 1) - 1) });
  const openContextMenu = (): void => {
    const label = selectedLabel(layout, selection, repository);
    if (label) canvas.current?.openContextMenu({ kind: 'label', label, more: [] });
    else if (selectedId !== null) canvas.current?.openContextMenu({ kind: 'changeset', id: layout.nodes.get(selectedId)?.changeset.id ?? selectedId });
    else if (selection?.kind === 'branch' && lane) canvas.current?.openContextMenu({ kind: 'branch', lane });
  };

  return [
    ['graphWalk', () => move({ kind: 'walk', direction: ARROW_DIRECTIONS[event.key]! })],
    ['graphBranchFirst', () => branchEdge('first')],
    ['graphBranchLast', () => branchEdge('last')],
    ['graphOldest', () => move({ kind: 'graphEdge', edge: 'first' })],
    ['graphNewest', () => move({ kind: 'graphEdge', edge: 'last' })],
    ['graphPageBack', () => page(-1)],
    ['graphPageForward', () => page(1)],
    ['graphMergeSource', () => move({ kind: 'mergeSource' })],
    ['graphMergeDestination', () => move({ kind: 'mergeDestination' })],
    ['graphBranchBase', () => move({ kind: 'branchBase' })],
    ['graphOpen', () => openSelection(layout, selection, repository)],
    [
      'graphOpenBranch',
      () => {
        if (lane) graphActions.diffBranch(lane.branch);
      },
    ],
    [
      'graphMerge',
      () => {
        if (selectedId !== null) graphActions.merge('merge', spec.changeset(selectedId));
        else if (selection?.kind === 'branch') graphActions.merge('merge', spec.branch(selection.name));
      },
    ],
    ['graphDetails', keyboard.toggleDetails],
    ['graphContextMenu', openContextMenu],
    // ⌘F is the palette command's; the view adds the plain key.
    ['graphFind', keyboard.find],
    ['graphHome', goHome],
    ['graphZoomIn', () => keyboard.zoomBy(ZOOM_STEP)],
    ['graphZoomOut', () => keyboard.zoomBy(1 / ZOOM_STEP)],
    ['graphFit', keyboard.fit],
    // Esc steps back: first out of the selection, then out of the focus.
    [
      'graphClear',
      () => {
        if (selection) select(null);
        else keyboard.exitFocus();
      },
    ],
  ];
}

function isPressed(id: ShortcutId, event: KeyboardEvent): boolean {
  if (id === 'graphContextMenu' && event.key === 'ContextMenu') return true;
  return hotkeys(id).some((key) => !(id === 'graphFind' && key === hotkey('graphFind')) && matchesShortcut(event.nativeEvent, key));
}

/** Fields keep every key (the search, an edited comment); buttons and links keep the keys that press them. */
function ownsKey(target: EventTarget, key: string): boolean {
  if (isTextEntry(target)) return true;
  return target instanceof HTMLElement && ['BUTTON', 'A'].includes(target.tagName) && (key === 'Enter' || key === ' ');
}
