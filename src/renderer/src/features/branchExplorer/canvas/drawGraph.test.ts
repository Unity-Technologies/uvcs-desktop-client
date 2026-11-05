import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AVATAR_COLORS } from '../../../lib/avatarColors';
import { largeHistory, sampleHistory } from '../model/graphFixtures';
import { layoutGraph } from '../model/layoutGraph';
import { NO_RULE_COLORS } from '../model/ruleColors';
import { searchGraph, searchHighlight } from '../model/searchGraph';
import type { DrawnTargets, GraphScene } from './drawContext';
import { DrawnBoxes } from './drawnBoxes';
import { drawGraph } from './drawGraph';
import { BAND_HEIGHT, columnX, rowY } from './geometry';
import type { GraphPalette } from './graphPalette';
import { DEFAULT_GRAPH_VIEW_OPTIONS, type GraphViewOptions } from './graphViewOptions';
import { centerOn } from './viewport';

// Some authors have a picture, the others their initials.
vi.mock('../../../lib/avatars/avatarImages', () => ({ avatarImageFor: (owner: string) => (owner.startsWith('dev1') ? {} : null) }));

/** The calls that place something on the canvas. */
const PLACING = new Set(['moveTo', 'lineTo', 'arcTo', 'bezierCurveTo', 'arc', 'rect', 'roundRect', 'fillRect', 'fillText', 'strokeText', 'drawImage']);

const PLACING_DRAWN = new Set([...PLACING].filter((name) => name !== 'strokeText'));

interface Placed {
  name: string;
  args: unknown[];
  /** The transform in effect, as `setTransform` takes it. */
  transform: number[];
}

/** A 2D context that records what is placed where, the transforms, and the inks it strokes and fills with. Everything else does nothing. */
function recordingContext(): { ctx: CanvasRenderingContext2D; placed: Placed[]; transforms: number[][]; inks: Set<unknown> } {
  const placed: Placed[] = [];
  const inks = new Set<unknown>();
  const transforms: number[][] = [];
  const saved: number[][] = [];
  let transform = [1, 0, 0, 1, 0, 0];
  const methods: Record<string, (...args: never[]) => unknown> = {
    setTransform: (...matrix: number[]) => transforms.push((transform = matrix)),
    save: () => saved.push(transform),
    restore: () => (transform = saved.pop() ?? transform),
    measureText: (text: string) => ({ width: text.length * 6 }),
    stroke: () => inks.add(state.strokeStyle),
    fill: () => inks.add(state.fillStyle),
  };
  const state: Record<string | symbol, unknown> = { font: '10px sans-serif', globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000' };
  const ctx = new Proxy(state, {
    get: (target, property) => {
      if (typeof property === 'string' && methods[property]) return methods[property];
      if (typeof property === 'string' && PLACING.has(property)) return (...args: unknown[]) => placed.push({ name: property, args, transform });
      return property in target ? target[property] : () => undefined;
    },
    set: (target, property, value) => {
      target[property] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, placed, transforms, inks };
}

const INK = '#888888';
const FONT = '10px sans-serif';
const palette: GraphPalette = {
  isDark: false,
  background: INK,
  surfaceRaised: INK,
  panel: INK,
  border: INK,
  textPrimary: INK,
  textSecondary: INK,
  textTertiary: INK,
  gridLine: INK,
  accent: INK,
  accentText: INK,
  headerText: { name: { saturation: '70%', contrast: 6.3 }, comment: { saturation: '30%', contrast: 4.7 } },
  accentContrast: INK,
  accentSoft: INK,
  accentWash: INK,
  multipleSelection: INK,
  multipleSelectionSoft: INK,
  searchHit: INK,
  labelBackground: INK,
  labelText: INK,
  labelMark: INK,
  badgeShadow: INK,
  mergeLinks: { interval: INK, cherryPick: INK, intervalCherryPick: INK, subtractive: INK, intervalSubtractive: INK },
  reviewStatus: { 'Under review': INK, Reviewed: INK, 'Rework required': INK },
  avatars: Object.fromEntries(AVATAR_COLORS.map((token) => [token, INK])) as GraphPalette['avatars'],
  avatarLetter: INK,
  fontUi: 'sans-serif',
  fonts: {
    branchName: FONT,
    branchComment: FONT,
    compactBranchName: FONT,
    badge: FONT,
    label: FONT,
    initials: FONT,
    collapsed: FONT,
    caption: FONT,
    ruler: FONT,
  },
  captionFontSize: 12,
  branchHues: true,
  ruleColors: NO_RULE_COLORS,
};

const PIXEL_RATIO = 2;
const ZOOM = 0.6;
const size = { width: 1400, height: 900 };
/**
 * About 12.8 million world px wide: its recent end lies past x = 1e7. The size is the claim (a canvas loses precision
 * that far out), an exception to tests' few thousand items; laid out in the `beforeAll` that needs it, not as the file loads.
 */
function farHistory() {
  const layout = layoutGraph(largeHistory(200_000, 60_000));
  const focus = layout.nodesByColumn[160_000]!;
  return { layout, focus, lane: layout.lanesByBranch.get(focus.changeset.branch)! };
}

function drawFar({ layout, focus, lane }: ReturnType<typeof farHistory>, search: GraphScene['search'], searchQuery = ''): ReturnType<typeof recordingContext> {
  const recording = recordingContext();
  const scene: GraphScene = {
    layout,
    viewport: centerOn({ zoom: ZOOM, panX: 0, panY: 0 }, columnX(focus.column), rowY(focus.row), size),
    size,
    palette,
    options: { ...DEFAULT_GRAPH_VIEW_OPTIONS, showComments: false },
    selectedChangeset: focus.changeset.id,
    selectedBranch: lane.branch.name,
    selectedPending: false,
    selectedChangesets: new Set([focus.changeset.id]),
    selectedBranches: new Set([lane.branch.name]),
    multipleSelection: false,
    hoveredChangeset: focus.changeset.id,
    hoveredBranch: lane.branch.name,
    hoveredReview: null,
    hoveredPending: false,
    homeChangeset: focus.changeset.id,
    pendingChangeCount: 0,
    currentBranch: lane.branch.name,
    highlightedAuthors: null,
    search,
    searchQuery,
    searchPing: 0.3,
    reviews: new Map([[lane.branch.id, { id: 1, title: 'Review', status: 'Reviewed', owner: 'jane', assignee: '', date: '' }]]),
  };
  const drawn: DrawnTargets = {
    reviewChips: new DrawnBoxes(),
    branchHeaders: new DrawnBoxes(),
    cutBranchNames: new DrawnBoxes(),
    cutBranchComments: new DrawnBoxes(),
    captions: new DrawnBoxes(),
  };
  drawGraph(recording.ctx, scene, PIXEL_RATIO, drawn);
  return recording;
}

/** Where a point placed under a transform lands on the device, computed in doubles. */
function device([a, b, c, d, e, f]: number[], x: number, y: number): { x: number; y: number } {
  return { x: a! * x + c! * y + e!, y: b! * x + d! * y + f! };
}

describe('drawGraph far into a huge history', () => {
  let far: ReturnType<typeof farHistory>;
  let frames: Record<'plain' | 'searching', ReturnType<typeof recordingContext>>;
  beforeAll(() => {
    far = farHistory();
    const hits = searchGraph(far.layout, 'task');
    frames = {
      plain: drawFar(far, null),
      searching: drawFar(far, searchHighlight(far.layout, hits, { kind: 'branch', name: far.lane.branch.name }), 'task'),
    };
  });

  it.each(['plain', 'searching'] as const)('hands the canvas only small numbers (%s)', (frame) => {
    const { placed, transforms } = frames[frame];
    expect(columnX(far.focus.column)).toBeGreaterThan(1e7);
    // Bands, links, avatars with and without a picture, labels, headers and their texts, the ruler.
    expect(new Set(placed.map(({ name }) => name))).toEqual(PLACING_DRAWN);
    const numbers = [...placed.flatMap(({ args }) => args), ...transforms.flat()].filter((value) => typeof value === 'number');
    expect(numbers.filter((value) => Math.abs(value) >= 1e5)).toEqual([]);
  });

  it('draws each changeset in view where its world position says', () => {
    const { placed } = frames.plain;
    const { layout, focus } = far;
    const { panX, panY } = centerOn({ zoom: ZOOM, panX: 0, panY: 0 }, columnX(focus.column), rowY(focus.row), size);
    const centers = placed.filter(({ name }) => name === 'arc').map(({ args, transform }) => device(transform, args[0] as number, args[1] as number));
    const inView = layout.nodesByColumn.slice(focus.column - 5, focus.column + 6).filter((node) => {
      const y = PIXEL_RATIO * (rowY(node.row) * ZOOM + panY);
      return y > 0 && y < size.height * PIXEL_RATIO;
    });
    expect(inView.length).toBeGreaterThan(0);
    for (const node of inView) {
      const expected = { x: PIXEL_RATIO * (columnX(node.column) * ZOOM + panX), y: PIXEL_RATIO * (rowY(node.row) * ZOOM + panY) };
      expect(centers.some(({ x, y }) => Math.abs(x - expected.x) < 1e-6 && Math.abs(y - expected.y) < 1e-6)).toBe(true);
    }
  });
});

/**
 * The small sample history at full size, centered, nothing selected: every display option has something to draw.
 * Comments are off (their captions measure fonts on a real canvas), as `drawFar` has them.
 */
function drawSample(options: Partial<GraphViewOptions> = {}, selection: Partial<GraphScene> = {}): ReturnType<typeof recordingContext> & { drawn: DrawnTargets } {
  const layout = layoutGraph(sampleHistory());
  const recording = recordingContext();
  const middle = layout.nodesByColumn[Math.floor(layout.nodesByColumn.length / 2)]!;
  const scene: GraphScene = {
    layout,
    viewport: centerOn({ zoom: 1, panX: 0, panY: 0 }, columnX(middle.column), rowY(middle.row), size),
    size,
    palette,
    options: { ...DEFAULT_GRAPH_VIEW_OPTIONS, showComments: false, ...options },
    selectedChangeset: null,
    selectedBranch: null,
    selectedPending: false,
    selectedChangesets: new Set(),
    selectedBranches: new Set(),
    multipleSelection: false,
    hoveredChangeset: null,
    hoveredBranch: null,
    hoveredReview: null,
    hoveredPending: false,
    homeChangeset: null,
    pendingChangeCount: 0,
    currentBranch: null,
    highlightedAuthors: null,
    search: null,
    searchQuery: '',
    searchPing: 0,
    reviews: new Map(),
    ...selection,
  };
  const drawn: DrawnTargets = {
    reviewChips: new DrawnBoxes(),
    branchHeaders: new DrawnBoxes(),
    cutBranchNames: new DrawnBoxes(),
    cutBranchComments: new DrawnBoxes(),
    captions: new DrawnBoxes(),
  };
  drawGraph(recording.ctx, scene, PIXEL_RATIO, drawn);
  return { ...recording, drawn };
}

const callsTo = (placed: Placed[], name: string) => placed.filter((call) => call.name === name);
const textsOf = (placed: Placed[]) => callsTo(placed, 'fillText').map(({ args }) => args[0]);

describe('drawGraph draws only what its display options ask for', () => {
  it('draws branches as bands, or as lines without them', () => {
    const bands = (placed: Placed[]) => callsTo(placed, 'roundRect').filter(({ args }) => args[3] === BAND_HEIGHT);
    const withBands = drawSample().placed;
    const withoutBands = drawSample({ showBranches: false }).placed;
    expect(bands(withBands).length).toBeGreaterThan(0);
    expect(bands(withoutBands)).toEqual([]);
    expect(callsTo(withoutBands, 'lineTo').length).toBeGreaterThan(callsTo(withBands, 'lineTo').length);
  });

  it('draws where a branch starts only when asked', () => {
    expect(callsTo(drawSample().placed, 'arcTo').length).toBeGreaterThan(0);
    expect(callsTo(drawSample({ showBranchStartLinks: false }).placed, 'arcTo')).toEqual([]);
  });

  it('draws merge links only when asked', () => {
    expect(callsTo(drawSample().placed, 'bezierCurveTo').length).toBeGreaterThan(0);
    expect(callsTo(drawSample({ showMergeLinks: false }).placed, 'bezierCurveTo')).toEqual([]);
  });

  it('draws labels only when asked', () => {
    expect(textsOf(drawSample().placed)).toContain('v1');
    expect(textsOf(drawSample({ showLabels: false }).placed)).not.toContain('v1');
  });

  it('names a branch by its last part without full names, and keeps the full name for its tooltip', () => {
    expect(textsOf(drawSample().placed)).toContain('/main/a');
    const { placed, drawn } = drawSample({ fullBranchNames: false });
    expect(textsOf(placed)).toContain('a');
    expect(textsOf(placed)).not.toContain('/main/a');
    expect(drawn.cutBranchNames.find((lane) => lane.branch.name === '/main/a')).not.toBeNull();
  });
});

describe('drawGraph draws a selection the same however many things it holds', () => {
  const SELECTION_SOFT = 'rgba(9, 105, 218, 0.12)';
  const selectionPalette: GraphPalette = { ...palette, accent: '#0969da', accentSoft: SELECTION_SOFT };
  /** The inks drawing a selection adds to the graph drawn with nothing selected. */
  const selectionInks = (selection: Partial<GraphScene>) => {
    const unselected = drawSample({}, { palette: selectionPalette }).inks;
    return [...drawSample({}, { palette: selectionPalette, ...selection }).inks].filter((ink) => !unselected.has(ink));
  };

  it('draws several branches in the selection color, as it draws one', () => {
    const one = selectionInks({ selectedBranch: '/main/a', selectedBranches: new Set(['/main/a']) });
    expect(one).toContain(SELECTION_SOFT);
    expect(selectionInks({ selectedBranch: '/main/b', selectedBranches: new Set(['/main/a', '/main/b']), multipleSelection: true })).toEqual(one);
  });

  it('draws several changesets in the selection color, as it draws one', () => {
    const one = selectionInks({ selectedChangeset: 2, selectedChangesets: new Set([2]) });
    expect(one).toContain(SELECTION_SOFT);
    expect(selectionInks({ selectedChangeset: 3, selectedChangesets: new Set([2, 3]), multipleSelection: true })).toEqual(one);
  });
});
