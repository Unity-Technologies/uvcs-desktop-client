import { describe, expect, it, vi } from 'vitest';
import { AVATAR_COLORS } from '../../../lib/avatarColors';
import { largeHistory } from '../model/graphFixtures';
import { layoutGraph } from '../model/layoutGraph';
import { searchGraph, searchHighlight } from '../model/searchGraph';
import type { DrawnTargets, GraphScene } from './drawContext';
import { DrawnBoxes } from './drawnBoxes';
import { drawGraph } from './drawGraph';
import { columnX, rowY } from './geometry';
import type { GraphPalette } from './graphPalette';
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

/** A 2D context that records what is placed where, and the transforms. Everything else does nothing. */
function recordingContext(): { ctx: CanvasRenderingContext2D; placed: Placed[]; transforms: number[][] } {
  const placed: Placed[] = [];
  const transforms: number[][] = [];
  const saved: number[][] = [];
  let transform = [1, 0, 0, 1, 0, 0];
  const methods: Record<string, (...args: never[]) => unknown> = {
    setTransform: (...matrix: number[]) => transforms.push((transform = matrix)),
    save: () => saved.push(transform),
    restore: () => (transform = saved.pop() ?? transform),
    measureText: (text: string) => ({ width: text.length * 6 }),
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
  return { ctx: ctx as unknown as CanvasRenderingContext2D, placed, transforms };
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
  searchHit: INK,
  labelBackground: INK,
  labelText: INK,
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
};

const PIXEL_RATIO = 2;
const ZOOM = 0.6;
const size = { width: 1400, height: 900 };
// About 12.8 million world px wide: its recent end lies past x = 1e7.
const layout = layoutGraph(largeHistory(200_000, 60_000));
const focus = layout.nodesByColumn[160_000]!;
const lane = layout.lanesByBranch.get(focus.changeset.branch)!;

function drawFar(search: GraphScene['search'], searchQuery = ''): ReturnType<typeof recordingContext> {
  const recording = recordingContext();
  const scene: GraphScene = {
    layout,
    viewport: centerOn({ zoom: ZOOM, panX: 0, panY: 0 }, columnX(focus.column), rowY(focus.row), size),
    size,
    palette,
    options: { showComments: false, showAvatars: true },
    selectedChangeset: focus.changeset.id,
    selectedBranch: lane.branch.name,
    selectedPending: false,
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
  const hits = searchGraph(layout, 'task');
  const frames = {
    plain: drawFar(null),
    searching: drawFar(searchHighlight(layout, hits, { kind: 'branch', name: lane.branch.name }), 'task'),
  };

  it.each(Object.entries(frames))('hands the canvas only small numbers (%s)', (_, { placed, transforms }) => {
    expect(columnX(focus.column)).toBeGreaterThan(1e7);
    // Bands, links, avatars with and without a picture, labels, headers and their texts, the ruler.
    expect(new Set(placed.map(({ name }) => name))).toEqual(PLACING_DRAWN);
    const numbers = [...placed.flatMap(({ args }) => args), ...transforms.flat()].filter((value) => typeof value === 'number');
    expect(numbers.filter((value) => Math.abs(value) >= 1e5)).toEqual([]);
  });

  it('draws each changeset in view where its world position says', () => {
    const { placed } = frames.plain;
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
