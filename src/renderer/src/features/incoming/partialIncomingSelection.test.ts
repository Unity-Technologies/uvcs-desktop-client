import { describe, expect, it } from 'vitest';
import type { PartialIncomingItem } from '@shared/domain/incoming';
import { partialItemKey } from './partialIncomingItems';
import { partialGroupCheckState, partialItemChecked, partialUpdateSelection, withItemsChecked } from './partialIncomingSelection';

const item = (kind: PartialIncomingItem['kind'], path: string, extra: Partial<PartialIncomingItem> = {}): PartialIncomingItem => ({
  kind,
  path,
  isDirectory: false,
  conflict: false,
  loadedRevisionId: kind === 'added' ? null : 1,
  headRevisionId: kind === 'removed' ? null : 2,
  ...extra,
});

const uncheckedOf = (...items: PartialIncomingItem[]): ReadonlySet<string> => new Set(items.map(partialItemKey));

describe('checking items', () => {
  const ship = item('changed', 'Code/Ship.cs');
  const hull = item('changed', 'Code/Hull.cs');

  it('starts with every item checked', () => {
    expect(partialItemChecked(ship, new Set())).toBe(true);
    expect(partialGroupCheckState([ship, hull], new Set())).toBe(true);
  });

  it('says a group is mixed when some of its items are unchecked, and unchecked when all are', () => {
    expect(partialGroupCheckState([ship, hull], uncheckedOf(ship))).toBe('mixed');
    expect(partialGroupCheckState([ship, hull], uncheckedOf(ship, hull))).toBe(false);
  });

  it('unchecks and checks items again without changing the set it was given', () => {
    const unchecked = withItemsChecked(new Set(), [ship, hull], false);
    expect(partialGroupCheckState([ship, hull], unchecked)).toBe(false);
    expect(partialItemChecked(ship, withItemsChecked(unchecked, [ship], true))).toBe(true);
    expect(unchecked.size).toBe(2);
  });

  it('keeps a removed and an added item at one path apart', () => {
    const removed = item('removed', 'Art/logo.png');
    const added = item('added', 'Art/logo.png');
    expect(partialItemChecked(added, uncheckedOf(removed))).toBe(true);
  });
});

describe('partialUpdateSelection', () => {
  it('names no path when every item is checked: the update brings them all', () => {
    const items = [item('changed', 'Code/Ship.cs'), item('added', 'Art/new.png')];
    expect(partialUpdateSelection(items, new Set())).toEqual({ paths: 'all', brought: items });
  });

  it('brings nothing when nothing is checked', () => {
    const ship = item('changed', 'Code/Ship.cs');
    expect(partialUpdateSelection([ship], uncheckedOf(ship))).toEqual({ paths: [], brought: [] });
  });

  it('updates a changed or removed item by its own path', () => {
    const ship = item('changed', 'Code/Ship.cs');
    const gone = item('removed', 'Old/gone.txt');
    const other = item('changed', 'Art/sky.png');
    expect(partialUpdateSelection([ship, gone, other], uncheckedOf(other))).toEqual({ paths: ['Code/Ship.cs', 'Old/gone.txt'], brought: [ship, gone] });
  });

  it('updates an added item through its parent folder, which brings what else changed under it', () => {
    const hull = item('added', 'Code/Hull.cs');
    const ship = item('changed', 'Code/Ship.cs');
    const sky = item('changed', 'Art/sky.png');
    expect(partialUpdateSelection([hull, ship, sky], uncheckedOf(ship, sky))).toEqual({ paths: ['Code'], brought: [hull, ship] });
  });

  it('brings everything when an added item sits at the top of the workspace', () => {
    const readme = item('added', 'README.md');
    const sky = item('changed', 'Art/sky.png');
    expect(partialUpdateSelection([readme, sky], uncheckedOf(sky))).toEqual({ paths: 'all', brought: [readme, sky] });
  });

  it('updates a moved item at its loaded path and in the folder it moves into', () => {
    const moved = item('moved', 'Art/Ships/hull.png', { oldPath: 'Textures/hull.png' });
    const sky = item('changed', 'Art/sky.png');
    const ui = item('changed', 'UI/menu.png');
    expect(partialUpdateSelection([moved, sky, ui], uncheckedOf(sky, ui))).toEqual({ paths: ['Art/Ships', 'Textures/hull.png'], brought: [moved] });
  });

  it('finds an item inside a folder the head moved at the folder\'s loaded path', () => {
    const folder = item('moved', 'Game/Code', { oldPath: 'Code', isDirectory: true });
    const ship = item('changed', 'Game/Code/Ship.cs');
    const sky = item('changed', 'Art/sky.png');
    expect(partialUpdateSelection([folder, ship, sky], uncheckedOf(folder, sky))).toEqual({ paths: ['Code/Ship.cs'], brought: [ship] });
  });

  it('passes only the outermost of nested paths', () => {
    const added = item('added', 'Code/Ships/Hull.cs');
    const ship = item('changed', 'Code/Ships/Ship.cs');
    const engine = item('changed', 'Code/Ships/Parts/Engine.cs');
    const sky = item('changed', 'Art/sky.png');
    expect(partialUpdateSelection([added, ship, engine, sky], uncheckedOf(sky))).toEqual({ paths: ['Code/Ships'], brought: [added, ship, engine] });
  });

  it('names no path when the paths asked for bring every item anyway', () => {
    const hull = item('added', 'Code/Hull.cs');
    const ship = item('changed', 'Code/Ship.cs');
    expect(partialUpdateSelection([hull, ship], uncheckedOf(ship))).toEqual({ paths: 'all', brought: [hull, ship] });
  });

  it('does not take a folder for one whose name it starts', () => {
    const ship = item('changed', 'Code/Ship.cs');
    const tool = item('changed', 'CodeGen/Tool.cs');
    expect(partialUpdateSelection([ship, tool], uncheckedOf(tool))).toEqual({ paths: ['Code/Ship.cs'], brought: [ship] });
  });
});
