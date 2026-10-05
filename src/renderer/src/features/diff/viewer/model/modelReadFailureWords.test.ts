import { describe, expect, it } from 'vitest';
import { modelReadFailureWords } from './modelReadFailureWords';

describe('modelReadFailureWords', () => {
  it('names the file a glTF needs, and how to make one that needs none', () => {
    expect(modelReadFailureWords({ kind: 'externalData', file: 'scene.bin' })).toEqual({
      title: 'This glTF keeps its geometry in scene.bin',
      description: 'Only a model whose file holds all of its data shows here: export it as GLB, or embed its buffers.',
    });
  });

  it('names the compression a glTF needs a decoder for', () => {
    expect(modelReadFailureWords({ kind: 'compressed', compression: 'Draco' }).title).toBe('This glTF is compressed with Draco');
  });
});
