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

  it('reads a value Unity folded onto the next lines, past its line width', () => {
    const material = parseUnityYaml(
      [
        'Material:',
        '  m_Shader: {fileID: -6465566751694194690, guid: 4003ffa965d444d209561b52e55c61fc,',
        '    type: 3}',
        '  m_ShaderKeywords: BOOLEAN_5C6B42CA_ON VERTEX_ANIMATION_ON _CORRECTNORMALS_OFF',
        '    _NORMALMAP',
        '  m_SavedProperties:',
        '    m_TexEnvs:',
        '    - _BaseMap:',
        '        m_Texture: {fileID: 2800000, guid: 8fd1a09f036e77d46a48c04c8d159cb9,',
        '          type: 3}',
      ].join('\r\n'),
    );
    expect(material.Material).toEqual({
      m_Shader: { fileID: '-6465566751694194690', guid: '4003ffa965d444d209561b52e55c61fc', type: '3' },
      m_ShaderKeywords: 'BOOLEAN_5C6B42CA_ON VERTEX_ANIMATION_ON _CORRECTNORMALS_OFF _NORMALMAP',
      m_SavedProperties: { m_TexEnvs: [{ _BaseMap: { m_Texture: { fileID: '2800000', guid: '8fd1a09f036e77d46a48c04c8d159cb9', type: '3' } } }] },
    });
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
