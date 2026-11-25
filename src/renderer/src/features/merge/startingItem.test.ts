import { describe, expect, it } from 'vitest';
import type { DirectoryConflict, MergePlan } from '@shared/domain/merge';
import { resolutionsByConflict } from './directoryConflicts/directoryDecisions';
import { buildMergeItems, mergeProgress, type MergeItem } from './mergeItems';
import { pairMergeMetas } from './mergeMetaPairs';
import type { ConflictedFile, FileConflictState } from './resolve/useFileConflicts';
import { startingItem } from './startingItem';

const conflicted = (path: string): ConflictedFile => ({ key: `/${path}`, path, base: { kind: 'empty' }, source: { kind: 'empty' }, destination: { kind: 'empty' } });
const clouds = conflicted('Lighting/Clouds.cs');
const sky = conflicted('Lighting/Sky.cs');
const sun = conflicted('Lighting/Sun.cs');

const base = { file: clouds, isBinary: false, decidedByUser: false, remainingConflicts: 0 };
/** Its versions still loading: whether it merges by itself isn't known yet. */
const loading = (file: ConflictedFile): FileConflictState => ({ ...base, file, status: 'loading', resolution: null, mergedAutomatically: false });
/** Merged with no conflicting regions: nothing for the user to decide. */
const automatic = (file: ConflictedFile): FileConflictState => ({ ...base, file, status: 'ready', resolution: { choice: 'text', text: '' }, mergedAutomatically: true });
/** Loaded, with conflicts the user must decide. */
const manual = (file: ConflictedFile): FileConflictState => ({ ...base, file, status: 'ready', resolution: null, mergedAutomatically: false, remainingConflicts: 1 });
/** Its versions couldn't be read: the user decides it. */
const unreadable = (file: ConflictedFile): FileConflictState => ({ ...base, file, status: 'error', error: new Error('Not found'), resolution: null, mergedAutomatically: false });

const side = { operation: 'added' as const, path: '/twin.txt', description: 'Added /twin.txt' };
const twin: DirectoryConflict = { type: 'evilTwin', title: 'Evil twin', explanation: '', itemId: 1, isDirectory: false, source: side, destination: side };
const plan = (directoryConflicts: DirectoryConflict[] = [], changes: MergePlan['changes'] = [{ kind: 'changed', path: '/Lighting/Probes/Probe1.cs' }]): MergePlan => ({
  status: 'ready',
  changes,
  fileConflicts: [],
  directoryConflicts,
  warnings: [],
});

const pathOf = (item: MergeItem | undefined): string | undefined => item?.path;

describe('startingItem', () => {
  const items = buildMergeItems(plan(), [], [sun, clouds, sky]);

  it('starts on the first conflict that needs the user, past those before it that merge by themselves', () => {
    const progress = mergeProgress([manual(sun), automatic(clouds), automatic(sky)], resolutionsByConflict([]));
    expect(pathOf(startingItem(null, items, progress))).toBe('Lighting/Sun.cs');
  });

  it("waits while a conflict before the first that needs the user is still loading: it may merge by itself", () => {
    const progress = mergeProgress([manual(sun), loading(clouds), automatic(sky)], resolutionsByConflict([]));
    expect(startingItem(null, items, progress)).toBeUndefined();
  });

  it('starts at once on a conflict that needs the user when everything before it has loaded, whatever loads after', () => {
    const progress = mergeProgress([loading(sun), automatic(clouds), manual(sky)], resolutionsByConflict([]));
    expect(pathOf(startingItem(null, items, progress))).toBe('Lighting/Sky.cs');
  });

  it('waits while nothing has loaded yet', () => {
    const progress = mergeProgress([loading(sun), loading(clouds), loading(sky)], resolutionsByConflict([]));
    expect(startingItem(null, items, progress)).toBeUndefined();
  });

  it('starts on a conflict whose versions could not be read: the user decides it', () => {
    const progress = mergeProgress([manual(sun), unreadable(clouds), automatic(sky)], resolutionsByConflict([]));
    expect(pathOf(startingItem(null, items, progress))).toBe('Lighting/Clouds.cs');
  });

  it('starts on the first row when every conflict merges by itself', () => {
    const progress = mergeProgress([automatic(sun), automatic(clouds), automatic(sky)], resolutionsByConflict([]));
    expect(pathOf(startingItem(null, items, progress))).toBe('Lighting/Clouds.cs');
  });

  it('starts on a directory conflict first, without waiting for any file to load', () => {
    const withTwin = buildMergeItems(plan([twin]), [], [sun, clouds]);
    const progress = mergeProgress([loading(sun), loading(clouds)], resolutionsByConflict([]));
    expect(pathOf(startingItem(null, withTwin, progress))).toBe('twin.txt');
  });

  it('starts on the first file that needs the user once the directory conflicts are decided', () => {
    const withTwin = buildMergeItems(plan(), [{ conflict: twin, resolution: { choice: 'source' } }], [sun, clouds]);
    const progress = mergeProgress([manual(sun), automatic(clouds)], resolutionsByConflict([{ conflict: twin, resolution: { choice: 'source' } }]));
    expect(pathOf(startingItem(null, withTwin, progress))).toBe('Lighting/Sun.cs');
  });

  it('never moves a selection already made, by the user or by the page', () => {
    const progress = mergeProgress([manual(sun), automatic(clouds), automatic(sky)], resolutionsByConflict([]));
    expect(startingItem('file:/Lighting/Clouds.cs', items, progress)).toBeUndefined();
  });

  it("starts on a conflicting Unity .meta that needs the user: it keeps its own row, never joined to its asset's", () => {
    const asset = conflicted('Assets/Hero.prefab');
    const meta = conflicted('Assets/Hero.prefab.meta');
    const shown = pairMergeMetas(buildMergeItems(plan(), [], [asset, meta])).shown;
    const progress = mergeProgress([automatic(asset), manual(meta)], resolutionsByConflict([]));
    expect(pathOf(startingItem(null, shown, progress))).toBe('Assets/Hero.prefab.meta');
  });

  it('starts on the first change to apply in a merge with no conflicts', () => {
    const changes: MergePlan['changes'] = [
      { kind: 'changed', path: '/Lighting/Probes/Probe2.cs' },
      { kind: 'added', path: '/Lighting/Probes/Probe1.cs' },
    ];
    const clean = buildMergeItems(plan([], changes), [], []);
    expect(pathOf(startingItem(null, clean, mergeProgress([], resolutionsByConflict([]))))).toBe('Lighting/Probes/Probe1.cs');
  });

  it('selects nothing when the merge lists nothing', () => {
    expect(startingItem(null, [], mergeProgress([], resolutionsByConflict([])))).toBeUndefined();
  });
});
