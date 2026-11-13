/**
 * Unity writes a `.meta` file beside every asset and folder (`Player.png` → `Player.png.meta`), and the two change
 * together. A list of changed files shows such a pair as one row, the asset's, so the meta doesn't double every list
 * of a Unity project; actions that change data take the meta along, and the asset's menu offers the meta's own views.
 *
 * A meta joins its asset only when both are in the list and changed the same way (`kindOf`: a pending change's kinds,
 * a diff's category, a changelist). Otherwise it stays a row of its own, so nothing that changed alone is hidden.
 * Names match exactly, as Unity writes them; pairing is always on, since a `.meta` beside its asset means Unity.
 */

const META_SUFFIX = '.meta';

/** The rows to show, and the meta each asset row stands for too. */
export interface MetaPairs<T> {
  /** The items without the metas that joined their asset, in their order. */
  shown: T[];
  /** The meta that joined this asset, if any. */
  metaOf: (item: T) => T | undefined;
  /** Whether this item is a meta that joined its asset, so it has no row of its own. */
  isJoinedMeta: (item: T) => boolean;
  /** How many metas joined an asset: listed counts leave them out. */
  pairedCount: number;
}

/** The asset a `.meta` file belongs to (`a/b.png.meta` → `a/b.png`), or null for what isn't one. */
export function assetOfMeta(path: string): string | null {
  if (!path.endsWith(META_SUFFIX)) return null;
  const asset = path.slice(0, -META_SUFFIX.length);
  if (asset === '' || asset.endsWith('/') || asset.endsWith('\\')) return null;
  return asset;
}

/** Pairs each `.meta` with its asset in one pass over the list. */
export function pairUnityMetas<T>(items: readonly T[], pathOf: (item: T) => string, kindOf: (item: T) => string): MetaPairs<T> {
  const listed = items.map((item) => ({ item, path: pathOf(item) }));
  const byPath = new Map<string, T>();
  for (const { item, path } of listed) if (!byPath.has(path)) byPath.set(path, item);

  const metas = new Map<T, T>();
  const joined = new Set<T>();
  for (const { item, path } of listed) {
    const assetPath = assetOfMeta(path);
    // A meta of a meta stays shown: chains would hide a change behind a row that is itself hidden.
    if (assetPath === null || assetOfMeta(assetPath) !== null) continue;
    const asset = byPath.get(assetPath);
    if (asset === undefined || metas.has(asset) || kindOf(asset) !== kindOf(item)) continue;
    metas.set(asset, item);
    joined.add(item);
  }

  return {
    shown: joined.size === 0 ? [...items] : items.filter((item) => !joined.has(item)),
    metaOf: (item) => metas.get(item),
    isJoinedMeta: (item) => joined.has(item),
    pairedCount: joined.size,
  };
}

/**
 * Whether an item's `.meta` is listed too, changed the same way (`kindOf`): the pairing `pairUnityMetas` will make.
 * A list that leaves out folders added or deleted with what they hold keeps such a folder, so its meta rides on the
 * folder's row instead of showing alone (Unity writes `Assets/Props.meta` beside the folder `Assets/Props`).
 */
export function hasMetaAlike<T>(items: readonly T[], pathOf: (item: T) => string, kindOf: (item: T) => string): (item: T) => boolean {
  const metaKinds = new Map<string, string>();
  for (const item of items) {
    const path = pathOf(item);
    if (assetOfMeta(path) !== null && !metaKinds.has(path)) metaKinds.set(path, kindOf(item));
  }
  return (item) => {
    const path = pathOf(item);
    return assetOfMeta(path) === null && metaKinds.get(path + META_SUFFIX) === kindOf(item);
  };
}

/** The items with each one's meta right after it: what an action that changes data acts on. */
export function withMetas<T>(items: readonly T[], metaOf: (item: T) => T | undefined): T[] {
  return items.flatMap((item) => {
    const meta = metaOf(item);
    return meta === undefined ? [item] : [item, meta];
  });
}

/**
 * The rows a filter leaves (`visible`, items of the paired list): a row stays while its asset or its meta is visible,
 * so filtering the list after pairing never splits a pair nor hides a meta that matched alone.
 */
export function shownRowsOf<T>(pairs: MetaPairs<T>, visible: readonly T[]): T[] {
  const kept = new Set(visible);
  return pairs.shown.filter((row) => {
    if (kept.has(row)) return true;
    const meta = pairs.metaOf(row);
    return meta !== undefined && kept.has(meta);
  });
}

/**
 * What a diff shows for a listed asset: its `.meta` while the meta is shown for that asset (`metaShownFor`, the asset's
 * path), else the asset itself.
 */
export function diffedItem<T extends { path: string }>(asset: T, meta: T | undefined, metaShownFor: string | null): T {
  return meta && metaShownFor === asset.path ? meta : asset;
}
