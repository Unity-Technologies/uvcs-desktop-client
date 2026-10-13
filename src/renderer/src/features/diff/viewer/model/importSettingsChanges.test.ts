import { describe, expect, it } from 'vitest';
import { importSettingsChanges } from './importSettingsChanges';
import { DEFAULT_IMPORT_SETTINGS, type ModelImportSettings } from './modelImportSettings';
import { modelSummary } from './modelSummary';
import { testModel, type TestModel } from './testing/testModels';

const robot = (overrides: Partial<TestModel> = {}): TestModel => ({
  nodes: [{ name: 'Hips', kind: 'bone' }, { name: 'Hand_L', parent: 'Hips', kind: 'bone' }, { name: 'Body', mesh: { slots: ['Skin', 'Metal'] } }],
  clips: [{ name: 'Wave', duration: 1.2 }],
  frameRate: 30,
  ...overrides,
});
const settings = (overrides: Partial<ModelImportSettings> = {}): ModelImportSettings => ({ ...DEFAULT_IMPORT_SETTINGS, ...overrides });
const remap = (slot: string) => ({ slot, guid: '0f2b6c1e9a8d4b3c8e7f6a5b4c3d2e1f' });
const side = (model: TestModel, importSettings: ModelImportSettings) => ({ summary: modelSummary(testModel(model)), settings: importSettings });

describe('importSettingsChanges', () => {
  it('finds nothing when the settings still fit the model', () => {
    const fitted = settings({ humanoid: true, humanBones: [{ humanName: 'LeftHand', boneName: 'Hand_L' }], clips: [{ name: 'Wave', takeName: 'Wave', firstFrame: 0, lastFrame: 36 }], materialRemaps: [remap('Skin')] });
    expect(importSettingsChanges(side(robot(), fitted), side(robot(), fitted))).toEqual([]);
  });

  it('tells a Scale Factor changed, and Convert Units turned off', () => {
    expect(importSettingsChanges(side(robot(), settings()), side(robot(), settings({ scaleFactor: 100, convertUnits: false })))).toEqual([
      { kind: 'scaleFactor', before: { scaleFactor: 1, convertUnits: true }, after: { scaleFactor: 100, convertUnits: false } },
    ]);
  });

  it('tells a material remapped onto a slot the model no longer has', () => {
    const remapped = settings({ materialRemaps: [remap('Skin'), remap('Metal')] });
    const after = robot({ nodes: [{ name: 'Hips', kind: 'bone' }, { name: 'Hand_L', parent: 'Hips', kind: 'bone' }, { name: 'Body', mesh: { slots: ['Skin_mat', 'Metal'] } }] });
    expect(importSettingsChanges(side(robot(), remapped), side(after, remapped))).toEqual([{ kind: 'remapLost', slot: 'Skin' }]);
  });

  it("tells a Humanoid avatar's bone the model no longer has, and only for a Humanoid", () => {
    const avatar = settings({ humanoid: true, humanBones: [{ humanName: 'Hips', boneName: 'Hips' }, { humanName: 'LeftHand', boneName: 'Hand_L' }] });
    const renamed = robot({ nodes: [{ name: 'Hips', kind: 'bone' }, { name: 'hand.L', parent: 'Hips', kind: 'bone' }, { name: 'Body', mesh: {} }] });
    expect(importSettingsChanges(side(robot(), avatar), side(renamed, avatar))).toEqual([{ kind: 'avatarBoneLost', humanName: 'LeftHand', boneName: 'Hand_L' }]);
    expect(importSettingsChanges(side(robot(), { ...avatar, humanoid: false }), side(renamed, { ...avatar, humanoid: false }))).toEqual([]);
  });

  it("tells a clip that ends past its take's frames now, or whose take is gone", () => {
    const split = settings({ clips: [{ name: 'Wave', takeName: 'Wave', firstFrame: 0, lastFrame: 36 }] });
    expect(importSettingsChanges(side(robot(), split), side(robot({ clips: [{ name: 'Wave', duration: 0.8 }] }), split))).toEqual([
      { kind: 'clipPastTake', clip: 'Wave', take: 'Wave', lastFrame: 36, takeFrames: 24 },
    ]);
    expect(importSettingsChanges(side(robot(), split), side(robot({ clips: [{ name: 'Hello', duration: 1.2 }] }), split))).toEqual([{ kind: 'clipTakeLost', clip: 'Wave', take: 'Wave' }]);
  });

  it('tells only what this change broke, not what was broken already', () => {
    const remapped = settings({ materialRemaps: [remap('Gone')] });
    expect(importSettingsChanges(side(robot(), remapped), side(robot(), remapped))).toEqual([]);
  });
});
