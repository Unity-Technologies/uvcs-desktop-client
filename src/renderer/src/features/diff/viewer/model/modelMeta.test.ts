import { describe, expect, it } from 'vitest';
import { modelOfMeta } from './modelMeta';

describe('modelOfMeta', () => {
  it("names the model a model's .meta belongs to, whatever the case", () => {
    expect(modelOfMeta('Assets/Characters/Hero.FBX.meta')).toBe('Assets/Characters/Hero.FBX');
    expect(modelOfMeta('Assets\\Props\\Barrel.gltf.meta')).toBe('Assets\\Props\\Barrel.gltf');
  });

  it("is nothing for another asset's .meta, or a model itself", () => {
    expect(modelOfMeta('Assets/Textures/Wood.png.meta')).toBeNull();
    expect(modelOfMeta('Assets/Hero.fbx')).toBeNull();
  });
});
