import { describe, expect, it } from 'vitest';
import { assetOfMeta, diffedItem, hasMetaAlike, pairUnityMetas, shownRowsOf, withMetas } from './unityMetaPairs';

interface Item {
  path: string;
  kind: string;
}

const item = (path: string, kind = 'changed'): Item => ({ path, kind });
const pathOf = (listed: Item): string => listed.path;
const kindOf = (listed: Item): string => listed.kind;
const paths = (items: readonly Item[]): string[] => items.map(pathOf);

describe('pairUnityMetas', () => {
  it("hides a meta behind its asset when both changed the same way", () => {
    const texture = item('Assets/Player.png');
    const meta = item('Assets/Player.png.meta');
    const pairs = pairUnityMetas([texture, meta], pathOf, kindOf);

    expect(paths(pairs.shown)).toEqual(['Assets/Player.png']);
    expect(pairs.metaOf(texture)).toBe(meta);
    expect(pairs.pairedCount).toBe(1);
    expect([texture, meta].map(pairs.isJoinedMeta)).toEqual([false, true]);
  });

  it('pairs a folder with its meta', () => {
    const folder = item('Assets/Textures', 'added');
    const meta = item('Assets/Textures.meta', 'added');
    const pairs = pairUnityMetas([meta, folder], pathOf, kindOf);

    expect(paths(pairs.shown)).toEqual(['Assets/Textures']);
    expect(pairs.metaOf(folder)).toBe(meta);
  });

  it('keeps the order of the assets, wherever their metas were listed', () => {
    const items = [item('b.png.meta'), item('a.png'), item('c.txt'), item('b.png'), item('a.png.meta')];

    expect(paths(pairUnityMetas(items, pathOf, kindOf).shown)).toEqual(['a.png', 'c.txt', 'b.png']);
  });

  it('lists a meta that changed alone as a change of its own', () => {
    const meta = item('Assets/Player.png.meta');
    const pairs = pairUnityMetas([item('Assets/Enemy.png'), meta], pathOf, kindOf);

    expect(paths(pairs.shown)).toEqual(['Assets/Enemy.png', 'Assets/Player.png.meta']);
    expect(pairs.metaOf(meta)).toBeUndefined();
    expect(pairs.isJoinedMeta(meta)).toBe(false);
    expect(pairs.pairedCount).toBe(0);
  });

  it('lists the asset and its meta apart when they changed in different ways', () => {
    const texture = item('Assets/Player.png', 'changed');
    const pairs = pairUnityMetas([texture, item('Assets/Player.png.meta', 'added')], pathOf, kindOf);

    expect(paths(pairs.shown)).toEqual(['Assets/Player.png', 'Assets/Player.png.meta']);
    expect(pairs.metaOf(texture)).toBeUndefined();
  });

  it('matches the name exactly, as Unity writes it', () => {
    const items = [item('Assets/Player.png'), item('Assets/player.png.meta'), item('Assets/Enemy.png'), item('Assets/Enemy.png.META')];

    expect(pairUnityMetas(items, pathOf, kindOf).shown).toHaveLength(4);
  });

  it('pairs Windows paths as they are listed', () => {
    const texture = item('Assets\\Art\\Player.png');
    const pairs = pairUnityMetas([texture, item('Assets\\Art\\Player.png.meta')], pathOf, kindOf);

    expect(paths(pairs.shown)).toEqual(['Assets\\Art\\Player.png']);
  });

  it('never hides a meta behind another meta', () => {
    const meta = item('a.png.meta');
    const metaOfMeta = item('a.png.meta.meta');
    const pairs = pairUnityMetas([item('a.png'), meta, metaOfMeta], pathOf, kindOf);

    expect(paths(pairs.shown)).toEqual(['a.png', 'a.png.meta.meta']);
  });

  it("doesn't take a file named only .meta for a meta", () => {
    expect(paths(pairUnityMetas([item('.meta')], pathOf, kindOf).shown)).toEqual(['.meta']);
    expect(paths(pairUnityMetas([item('Assets/.meta'), item('Assets/')], pathOf, kindOf).shown)).toEqual(['Assets/.meta', 'Assets/']);
  });

  it('leaves a list without metas as it was', () => {
    const items = [item('a.cs'), item('b.cs')];
    const pairs = pairUnityMetas(items, pathOf, kindOf);

    expect(pairs.shown).toEqual(items);
    expect(pairs.pairedCount).toBe(0);
  });

  it('reads each path once, however long the list', () => {
    const items = Array.from({ length: 4000 }, (_, index) => item(index % 2 ? `Assets/${index - 1}.png.meta` : `Assets/${index}.png`));
    let reads = 0;
    const pairs = pairUnityMetas(items, (listed) => (reads++, listed.path), kindOf);

    expect(pairs.shown).toHaveLength(2000);
    expect(reads).toBe(4000);
  });
});

describe('withMetas', () => {
  it('adds the metas of the assets, right after each one', () => {
    const items = [item('a.png'), item('a.png.meta'), item('b.cs'), item('c.png'), item('c.png.meta')];
    const pairs = pairUnityMetas(items, pathOf, kindOf);
    const [a, b, c] = pairs.shown;

    expect(paths(withMetas([c!, b!, a!], pairs.metaOf))).toEqual(['c.png', 'c.png.meta', 'b.cs', 'a.png', 'a.png.meta']);
  });
});

describe('shownRowsOf', () => {
  const items = [item('a.png'), item('a.png.meta'), item('b.png'), item('b.png.meta'), item('c.cs')];
  const pairs = pairUnityMetas(items, pathOf, kindOf);
  const [a, aMeta, b, bMeta, c] = items;

  it("keeps the rows' order, whatever the visible items' order", () => {
    expect(paths(shownRowsOf(pairs, [c!, bMeta!, a!]))).toEqual(['a.png', 'b.png', 'c.cs']);
  });

  it('keeps a row for either one alone, and drops it when neither is visible', () => {
    expect(paths(shownRowsOf(pairs, [aMeta!]))).toEqual(['a.png']);
    expect(paths(shownRowsOf(pairs, [b!]))).toEqual(['b.png']);
    expect(shownRowsOf(pairs, [])).toEqual([]);
  });
});

describe('assetOfMeta', () => {
  it("names a meta's asset", () => {
    expect(assetOfMeta('Assets/Player.png.meta')).toBe('Assets/Player.png');
  });

  it('is null for what is not a meta', () => {
    expect(assetOfMeta('Assets/Player.png')).toBeNull();
    expect(assetOfMeta('Assets/.meta')).toBeNull();
    expect(assetOfMeta('.meta')).toBeNull();
  });
});

describe('diffedItem', () => {
  const asset = { path: 'Assets/Player.png' };
  const meta = { path: 'Assets/Player.png.meta' };

  it("shows the meta's diff only while it is shown for the asset shown", () => {
    expect(diffedItem(asset, meta, 'Assets/Player.png')).toBe(meta);
    expect(diffedItem(asset, meta, 'Assets/Enemy.png')).toBe(asset);
    expect(diffedItem(asset, meta, null)).toBe(asset);
  });

  it('shows the asset when it has no meta listed', () => {
    expect(diffedItem(asset, undefined, 'Assets/Player.png')).toBe(asset);
  });
});

describe('hasMetaAlike', () => {
  type Item = { path: string; kind: string };
  const of = (items: Item[]) => hasMetaAlike(items, (item) => item.path, (item) => item.kind);

  it('says which items have their meta listed, changed the same way', () => {
    const folder = { path: 'Assets/Props', kind: 'added' };
    const file = { path: 'Assets/Props/box.prefab', kind: 'added' };
    const has = of([folder, { path: 'Assets/Props.meta', kind: 'added' }, file]);
    expect([has(folder), has(file)]).toEqual([true, false]);
  });

  it('says no when the meta changed otherwise', () => {
    const folder = { path: 'Assets/Props', kind: 'added' };
    expect(of([folder, { path: 'Assets/Props.meta', kind: 'changed' }])(folder)).toBe(false);
  });

  it('says no for a meta, whose own meta would chain', () => {
    const meta = { path: 'a.png.meta', kind: 'added' };
    expect(of([meta, { path: 'a.png.meta.meta', kind: 'added' }])(meta)).toBe(false);
  });
});
