import { describe, expect, it } from 'vitest';
import type { UnityAssetsAnswer, UnityAssetsRequest } from '@shared/domain/unityAssets';
import { DEFAULT_IMPORT_SETTINGS } from '../modelImportSettings';
import type { ImportSettingsSource } from '../modelImportSettings';
import { answerStateOf, comparableVersions, materialChangesOf, type AnswerState, type ComparisonInput } from './materialComparison';
import type { VersionPlan } from './materialPlan';
import { slotSources, type ModelMaterialsInput } from './slotSources';
import { fileMaterial } from './testing/testMaterials';

const GLASS_MAT = '0f2b6c1e9a8d4b3c8e7f6a5b4c3d2e1f';
const MODEL = 'Assets/Lantern/Lantern.fbx';

const request = (overrides: Partial<UnityAssetsRequest> = {}): UnityAssetsRequest => ({ modelPath: MODEL, textures: [], guids: [], paths: [], searchTexturesGlobally: false, ...overrides });
const answer = (overrides: Partial<UnityAssetsAnswer> = {}): UnityAssetsAnswer => ({ textures: [], guids: [], paths: [], importsPsb: false, guidMisses: 'known', ...overrides });

function side(settings: Partial<ModelMaterialsInput['settings']> = {}) {
  const input: ModelMaterialsInput = { format: 'fbx', slots: [{ key: 'Glass', name: 'Glass', material: fileMaterial('Glass') }], settings: { ...DEFAULT_IMPORT_SETTINGS, ...settings } };
  const sources = slotSources(input);
  return { sources, request: request({ guids: [...sources.values()].flatMap((source) => (source.kind === 'remapped' ? [source.guid] : [])) }) };
}

const none = side({ materialImport: 'none' });
const remapped = side({ materialImport: 'none', remapsWithoutMaterials: true, materialRemaps: [{ slot: 'Glass', guid: GLASS_MAT }] });

const plan = (material: 'default' | 'project'): VersionPlan => ({
  slots: new Map([['Glass', null]]),
  resolved: new Map([['Glass', { slot: 'Glass', material: material === 'default' ? { kind: 'default' } : { kind: 'project', guid: GLASS_MAT, name: 'Lantern_Glass', path: 'Assets/Lantern/Lantern_Glass.mat' }, baseMap: null, normalMap: null }]]),
  needs: [],
  issues: [],
});

function input(overrides: Partial<ComparisonInput> = {}): ComparisonInput {
  return { comparable: true, sides: [none, remapped], answers: ['answered', 'answered'], plans: [plan('default'), plan('project')], ...overrides };
}

describe('materialChangesOf', () => {
  it("tells what changed once both sides' materials are answered", () => {
    expect(materialChangesOf(input())).toEqual([
      { kind: 'source', slot: 'Glass', before: { kind: 'default' }, after: { kind: 'project', guid: GLASS_MAT, name: 'Lantern_Glass', path: 'Assets/Lantern/Lantern_Glass.mat' } },
    ]);
  });

  it("tells nothing changed, reading nothing, for versions whose materials can't resolve differently", () => {
    expect(materialChangesOf(input({ sides: [none, none], answers: ['reading', 'reading'], plans: [null, null] }))).toEqual([]);
  });

  it("can't tell without a workspace, a path in it, or a side the workspace couldn't answer", () => {
    expect(materialChangesOf(input({ comparable: false }))).toBeNull();
    expect(materialChangesOf(input({ answers: ['answered', 'noLibrary'] }))).toBeNull();
  });

  it('is being told while a side is read', () => {
    expect(materialChangesOf(input({ sides: [none, undefined] }))).toBeUndefined();
    expect(materialChangesOf(input({ answers: ['answered', 'reading'], plans: [plan('default'), null] }))).toBeUndefined();
  });
});

describe('answerStateOf', () => {
  const asked = request({ guids: [GLASS_MAT] });
  const state = (first: UnityAssetsAnswer | null | undefined, extra: { second?: UnityAssetsAnswer | null; materials?: Map<string, null> | undefined } = {}): AnswerState =>
    answerStateOf(asked, first, 'second' in extra ? asked : null, extra.second, 'materials' in extra ? extra.materials : new Map());

  it('is answered once every lookup and material read is', () => {
    expect(state(answer({ guids: [null] }))).toBe('answered');
    expect(state(answer(), { second: answer() })).toBe('answered');
  });

  it('is being read while any is', () => {
    expect(state(undefined)).toBe('reading');
    expect(state(answer(), { second: undefined })).toBe('reading');
    expect(state(answer(), { materials: undefined })).toBe('reading');
  });

  it("says why it can't be taken as so when a find failed, or a GUID not found isn't known missing", () => {
    expect(state(null)).toBe('unread');
    expect(state(answer(), { second: null })).toBe('unread');
    expect(state(answer({ guids: [null], guidMisses: 'noProject' }))).toBe('noProject');
    expect(answerStateOf(request({ textures: [{ name: 'glass.png', storedPaths: [], remapGuid: GLASS_MAT }] }), answer({ textures: [null], guidMisses: 'noLibrary' }), null, undefined, new Map())).toBe('noLibrary');
    expect(answerStateOf(request(), answer({ guidMisses: 'unread' }), null, undefined, new Map())).toBe('answered');
  });
});

describe('comparableVersions', () => {
  const version = (path: string | null, settingsFrom: ImportSettingsSource = 'meta') => ({ path, options: { settingsFrom } });

  it('compares two versions with a path in a workspace whose .meta was read or absent', () => {
    expect(comparableVersions('/ws', [version(MODEL), version(MODEL, 'none')])).toBe(true);
  });

  it("doesn't without a workspace, a version, a path, or with a .meta whose read failed (its defaults aren't its settings)", () => {
    expect(comparableVersions('', [version(MODEL), version(MODEL)])).toBe(false);
    expect(comparableVersions('/ws', [null, version(MODEL)])).toBe(false);
    expect(comparableVersions('/ws', [version(null), version(MODEL)])).toBe(false);
    expect(comparableVersions('/ws', [version(MODEL, 'failed'), version(MODEL)])).toBe(false);
  });
});
