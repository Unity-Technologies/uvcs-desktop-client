/** How much of each avatar behind the first one peeks out while the stack rests, as a share of its size. */
export const PEEK_SHARE = 0.5;

/** The room between two avatars once the stack spreads: enough for a ring around each (`AvatarStack`'s) to stay apart. */
export const SPREAD_GAP = 8;

/** Where one avatar of a stack sits, at rest and spread, and how far up it lies. */
export interface StackSlot {
  /** Its left edge at rest, from the stack's. */
  restX: number;
  /** Its left edge once spread. */
  spreadX: number;
  /** Its stacking order: the first avatar in front, each later one further back. */
  layer: number;
  /** Its place from the first, which staggers its spreading. */
  order: number;
  /** Its place from the last, which staggers its folding back, the outermost first. */
  reverseOrder: number;
}

export interface StackLayout {
  slots: StackSlot[];
  /** The stack's width at rest: what it takes in the layout, spread or not, so nothing beside it moves. */
  restWidth: number;
  /** Its width spread, which floats over what follows it. */
  spreadWidth: number;
}

/**
 * Where each of `count` avatars of `size` pixels sits: overlapping at rest, each behind the one before with
 * `PEEK_SHARE` of it showing, and side by side once spread, `SPREAD_GAP` apart.
 */
export function avatarStackLayout(count: number, size: number): StackLayout {
  const peek = Math.round(size * PEEK_SHARE);
  const slots = Array.from({ length: count }, (_, index) => ({
    restX: index * peek,
    spreadX: index * (size + SPREAD_GAP),
    layer: count - index,
    order: index,
    reverseOrder: count - 1 - index,
  }));
  const extent = (step: number) => (count === 0 ? 0 : size + (count - 1) * step);
  return { slots, restWidth: extent(peek), spreadWidth: extent(size + SPREAD_GAP) };
}
