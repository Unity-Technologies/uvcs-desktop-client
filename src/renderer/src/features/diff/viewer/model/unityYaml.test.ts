import { describe, expect, it } from 'vitest';
import { parseUnityYaml } from './unityYaml';

describe('parseUnityYaml', () => {
  it('reads nested mappings, keeping each setting where Unity puts it', () => {
    const meta = parseUnityYaml(['fileFormatVersion: 2', 'ModelImporter:', '  meshes:', '    globalScale: 100', '    useFileScale: 1', '  humanDescription:', '    globalScale: 1'].join('\r\n'));
    expect(meta).toEqual({ fileFormatVersion: '2', ModelImporter: { meshes: { globalScale: '100', useFileScale: '1' }, humanDescription: { globalScale: '1' } } });
  });

  it('reads sequences of mappings, as clip splits and bone maps are written', () => {
    const meta = parseUnityYaml(
      [
        'ModelImporter:',
        '  animations:',
        '    clipAnimations:',
        '    - serializedVersion: 16',
        '      name: Wave',
        '      takeName: Take 001',
        '      firstFrame: 0',
        '      lastFrame: 36',
        '    - serializedVersion: 16',
        '      name: Idle',
        '      lastFrame: 60',
        '  humanDescription:',
        '    human:',
        '    - boneName: Hand_L',
        '      humanName: LeftHand',
        '      limit:',
        '        min: {x: 0, y: 0, z: 0}',
      ].join('\n'),
    );
    const importer = meta.ModelImporter as Record<string, Record<string, unknown>>;
    expect(importer.animations!.clipAnimations).toEqual([
      { serializedVersion: '16', name: 'Wave', takeName: 'Take 001', firstFrame: '0', lastFrame: '36' },
      { serializedVersion: '16', name: 'Idle', lastFrame: '60' },
    ]);
    expect(importer.humanDescription!.human).toEqual([{ boneName: 'Hand_L', humanName: 'LeftHand', limit: { min: { x: '0', y: '0', z: '0' } } }]);
  });

  it('reads flow mappings, empty lists and empty values', () => {
    const meta = parseUnityYaml(['ModelImporter:', '  externalObjects:', '  - first:', '      type: UnityEngine:Material', '      name: Wood', '    second: {fileID: 2100000, guid: abc123, type: 2}', '  referencedClips: []', '  userData: '].join('\n'));
    expect(meta.ModelImporter).toEqual({
      externalObjects: [{ first: { type: 'UnityEngine:Material', name: 'Wood' }, second: { fileID: '2100000', guid: 'abc123', type: '2' } }],
      referencedClips: [],
      userData: '',
    });
  });
});
