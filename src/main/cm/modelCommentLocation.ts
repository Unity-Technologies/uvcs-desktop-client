import type { ModelPoint, ModelSpot, ModelSpotNode, ModelSpotView } from '@shared/domain/reviewConversation';

/*
 * A comment on a 3D model, as every client writes and reads it in `cm codereview comment add --location` (`cm` stores
 * the text as given and doesn't read it):
 *
 *   model:x,y,z[;node=<path>][;local=lx,ly,lz][;part][;view=dx,dy,dz,d]
 *
 * - `x,y,z`, the only part every reader needs: the point on the surface, in the file's own units and axes, before any
 *   import scale or axis turn a viewer applies, so any client computes the same point from the file.
 * - `node`: the part it's on, its names from the file's root down to it joined by `/`, each name percent-encoded
 *   (a `/` in a name too). Same-named siblings share a path; the point tells them apart.
 * - `local`: the point in that part's own space, which places it on the part wherever the part is now (another version,
 *   a take playing) without reading the version it was written on.
 * - `part`: the comment is about the whole part, not the point. A reader that ignores it shows a point.
 * - `view`: the camera it was written from, the direction from the point to the camera and its distance, in the
 *   file's space.
 *
 * Numbers are in the invariant culture ('.'), never with an exponent; values are percent-encoded UTF-8, so the whole
 * location is printable ASCII with no whitespace or quotes, which `cm` refuses and a `cm shell` line can't carry. A
 * hint a reader doesn't know, or can't read, is skipped; the point stays.
 */

/** `cm codereview comment add` refuses a longer location (its "Comment locations" help). */
export const MAX_LOCATION_LENGTH = 1024;

/** The spot of a model a review comment is on, from its location as `cm find changereviewcomment` prints it; none for another kind or a point it can't read. */
export function commentedModelSpotOf(location: string): ModelSpot | null {
  const [mandatory, ...hints] = location.trim().split(';');
  const match = /^model:(.*)$/.exec(mandatory!);
  const point = match ? pointOf(match[1]!) : null;
  if (!point) return null;
  const read = readHints(hints);
  const node: ModelSpotNode | undefined = read.path && { path: read.path, ...(read.local && { local: read.local }) };
  return {
    point,
    ...(node && { node }),
    ...(node && read.wholePart && { wholePart: true as const }),
    ...(read.view && { view: read.view }),
  };
}

interface ReadHints {
  path?: string[];
  local?: ModelPoint;
  wholePart?: boolean;
  view?: ModelSpotView;
}

function readHints(hints: string[]): ReadHints {
  const read: ReadHints = {};
  for (const hint of hints) {
    const equals = hint.indexOf('=');
    const name = equals < 0 ? hint : hint.slice(0, equals);
    const value = equals < 0 ? '' : hint.slice(equals + 1);
    if (name === 'node') read.path = nodePathOf(value) ?? read.path;
    else if (name === 'local') read.local = pointOf(value) ?? read.local;
    else if (name === 'part') read.wholePart = true;
    else if (name === 'view') read.view = viewOf(value) ?? read.view;
  }
  return read;
}

function pointOf(text: string): ModelPoint | null {
  const numbers = numbersOf(text, 3);
  return numbers && { x: numbers[0]!, y: numbers[1]!, z: numbers[2]! };
}

function viewOf(text: string): ModelSpotView | null {
  const numbers = numbersOf(text, 4);
  if (!numbers) return null;
  const [x, y, z, distance] = numbers as [number, number, number, number];
  if (distance <= 0 || (x === 0 && y === 0 && z === 0)) return null;
  return { direction: { x, y, z }, distance };
}

function numbersOf(text: string, count: number): number[] | null {
  const parts = text.split(',');
  if (parts.length !== count || !parts.every((part) => LOCATION_NUMBER.test(part))) return null;
  return parts.map(Number);
}

/** A number of a model's location: a sign maybe, digits, a decimal part maybe, in the invariant culture, no exponent. */
const LOCATION_NUMBER = /^-?\d+(\.\d+)?$/;

function nodePathOf(text: string): string[] | null {
  if (text === '') return null;
  try {
    return text.split('/').map(decodeURIComponent);
  } catch {
    return null;
  }
}

/**
 * `cm codereview comment add --location` on a model (`modelLocation`): its point always, its hints while they fit in
 * what `cm` takes.
 */
export function modelLocationOption(spot: ModelSpot): string {
  return `--location=${modelLocation(spot)}`;
}

/**
 * A spot written as `commentedModelSpotOf` reads it. A deep hierarchy of long names can pass `MAX_LOCATION_LENGTH`:
 * the hints go, the camera first, then the point in the part's space, then the part, until it fits; the point always
 * stays, as it alone places the comment.
 */
export function modelLocation(spot: ModelSpot): string {
  const point = `model:${pointText(spot.point)}`;
  const nodeHints = spot.node ? [`node=${spot.node.path.map(encodedName).join('/')}`] : [];
  const localHints = spot.node?.local ? [`local=${pointText(spot.node.local)}`] : [];
  const partHints = spot.node && spot.wholePart ? ['part'] : [];
  const viewHints = spot.view ? [`view=${[spot.view.direction.x, spot.view.direction.y, spot.view.direction.z, spot.view.distance].map(locationNumber).join(',')}`] : [];
  const tries = [
    [...nodeHints, ...localHints, ...partHints, ...viewHints],
    [...nodeHints, ...localHints, ...partHints],
    [...nodeHints, ...partHints],
    [],
  ];
  for (const hints of tries) {
    const location = [point, ...hints].join(';');
    if (location.length <= MAX_LOCATION_LENGTH) return location;
  }
  return point;
}

function pointText({ x, y, z }: ModelPoint): string {
  return [x, y, z].map(locationNumber).join(',');
}

/**
 * Significant digits a number keeps: a millimetre across ten kilometres in metres, the precision a file's 32-bit
 * floats hold anyway, and short.
 */
const SIGNIFICANT_DIGITS = 8;

/** The decimals past which a number near 0 is 0: `toFixed` writes no exponent, and keeps at most these. */
const MAX_DECIMALS = 9;

/**
 * A number as `commentedModelSpotOf` reads it: its significant digits, trailing zeros dropped, never an exponent
 * (`String(1e-7)` writes `1e-7`).
 */
export function locationNumber(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const decimals = Math.min(MAX_DECIMALS, Math.max(0, SIGNIFICANT_DIGITS - 1 - magnitude));
  // `toFixed` writes an exponent from 1e21 up.
  const fixed = Math.abs(value) < 1e21 ? value.toFixed(decimals) : BigInt(Math.round(value)).toString();
  const trimmed = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
  return trimmed === '-0' ? '0' : trimmed;
}

/** A node's name as a location holds it: percent-encoded UTF-8, quotes and `/` included, so it's printable ASCII. */
function encodedName(name: string): string {
  return encodeURIComponent(name).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}
