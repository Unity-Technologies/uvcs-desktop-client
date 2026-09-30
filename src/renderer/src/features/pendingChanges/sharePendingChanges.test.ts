import { describe, expect, it } from 'vitest';
import type { PendingChange, PendingChangesSnapshot } from '@shared/domain/pendingChanges';
import { readGrowthWhenDoubled } from '@shared/testing/countedReads';
import { sharePendingChanges } from './sharePendingChanges';

const change = (path: string, lastModified = '1', kinds: PendingChange['kinds'] = ['changed']): PendingChange => ({ path, kinds, itemType: 'file', size: 1, lastModified, oldPath: undefined });
const snapshot = (changes: PendingChange[], changelists = [{ name: 'UI', description: '' }]): PendingChangesSnapshot => ({ changes, changelists, mergeLinks: [] });
/** What a read hands over: equal values, never the same objects. */
const reread = (value: PendingChangesSnapshot): PendingChangesSnapshot => structuredClone(value);

describe('sharePendingChanges', () => {
  it('keeps the whole snapshot when a read finds everything as it was', () => {
    const previous = snapshot([change('a'), change('b', '1', ['checkedOut', 'changed'])]);
    expect(sharePendingChanges(previous, reread(previous))).toBe(previous);
  });

  it('keeps the changes found as they were and takes the others', () => {
    const previous = snapshot([change('a'), change('b'), change('c')]);
    const next = snapshot([change('a'), change('b', '2'), change('c', '1', ['checkedOut', 'changed']), change('d')]);
    const shared = sharePendingChanges(previous, reread(next));
    expect(shared).toEqual(next);
    expect(shared.changes[0]).toBe(previous.changes[0]);
    expect(shared.changes[1]).not.toBe(previous.changes[1]);
    expect(shared.changes[2]).not.toBe(previous.changes[2]);
    expect(shared.changelists).toBe(previous.changelists);
  });

  it('finds changes by path when they come in another order, or some went', () => {
    const previous = snapshot([change('a'), change('b'), change('c')]);
    const shared = sharePendingChanges(previous, reread(snapshot([change('c'), change('a')])));
    expect(shared.changes.map((item) => item.path)).toEqual(['c', 'a']);
    expect(shared.changes[0]).toBe(previous.changes[2]);
    expect(shared.changes[1]).toBe(previous.changes[0]);
  });

  it('tells other changelists', () => {
    const previous = snapshot([change('a')]);
    const described = sharePendingChanges(previous, reread(snapshot([change('a')], [{ name: 'UI', description: 'now described' }])));
    expect(described.changelists[0]!.description).toBe('now described');
    expect(described.changes).toBe(previous.changes);
  });

  it('shares 100,000 changes, reading each one a bounded number of times', () => {
    const many = snapshot(Array.from({ length: 100_000 }, (_, index) => change(`src/folder${index % 100}/file${index}.ts`)));
    const next = reread(many);
    next.changes[500] = change(next.changes[500]!.path, '2');
    const shared = sharePendingChanges(many, next);
    expect(shared.changes[499]).toBe(many.changes[499]);
    expect(shared.changes[500]).toBe(next.changes[500]);
  });

  it('shares in linear work, even when a change is added at the top and every place shifts', () => {
    const changes = (count: number) => Array.from({ length: count }, (_, index) => change(`src/file${index}.ts`));
    const growth = readGrowthWhenDoubled(1_000, changes, (previous) => sharePendingChanges(snapshot(previous), reread(snapshot([change('new.ts'), ...changes(previous.length)]))));
    expect(growth).toBeLessThan(2.1);
  });
});
