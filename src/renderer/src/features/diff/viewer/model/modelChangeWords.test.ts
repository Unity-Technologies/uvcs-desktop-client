import { describe, expect, it } from 'vitest';
import { changeRows } from './modelChangeWords';
import type { ModelChange, NodeRef } from './modelChanges';
import { formatLength, formatUnits } from './modelUnits';

const bone = (name: string, path = `Armature/${name}`): NodeRef => ({ name, path, kind: 'bone', after: path });
const mesh = (name: string): NodeRef => ({ name, path: name, kind: 'mesh', before: name, after: name });
const titles = (changes: ModelChange[]): string[] => changeRows(changes).map((row) => row.title);

describe('changeRows', () => {
  it('tells a model resized by its units, and why, in the attention tone', () => {
    const [row] = changeRows([{ kind: 'resized', factor: 0.01, heightBefore: 0.9, heightAfter: 0.009, cause: { kind: 'units', before: 1, after: 0.01 } }]);
    expect(row).toMatchObject({
      tone: 'risk',
      title: '100× smaller in Unity',
      detail: "The file's units changed from metres to centimetres. It was 90 cm tall, now 9 mm, in every scene that uses it.",
    });
  });

  it('tells a turn around an axis, and one about none', () => {
    expect(titles([{ kind: 'turned', degrees: 90, axis: 'X' }, { kind: 'turned', degrees: 37, axis: null }])).toEqual(['Turned 90° around X', 'Turned 37°']);
  });

  it('tells a rename by what binds to the name: bones to the avatar, the rest to overrides and scripts', () => {
    const [boneRow, meshRow] = changeRows([
      { kind: 'renamed', node: bone('hand.L'), from: 'Hand_L' },
      { kind: 'renamed', node: mesh('Visor'), from: 'Glass' },
    ]);
    expect(boneRow).toMatchObject({ title: 'Renamed Hand_L to hand.L', detail: 'The avatar and animations bind bones by name: they lose it.' });
    expect(meshRow!.detail).toBe('Prefab overrides, animations and scripts that find it by name lose it.');
  });

  it('tells a move with the path references had', () => {
    expect(changeRows([{ kind: 'moved', node: { name: 'Helmet', path: 'Armature/Head/Helmet', kind: 'mesh', after: 'Armature/Head/Helmet' }, fromPath: 'Helmet' }])[0]).toMatchObject({
      title: 'Moved Helmet under Head',
      detail: 'Animations and scripts that find it by its path (Helmet) lose it.',
    });
  });

  it('folds a run of one kind into a row listing them, focusing all of them', () => {
    const fingers = ['Thumb_L', 'Index_L', 'Middle_L'].map((name): ModelChange => ({ kind: 'added', node: bone(name) }));
    const rows = changeRows([...fingers, { kind: 'added', node: mesh('Antenna') }]);
    expect(rows.map((row) => row.title)).toEqual(['Added 3 bones', 'Added Antenna']);
    expect(rows[0]!.items!.map((item) => item.label)).toEqual(['Thumb_L', 'Index_L', 'Middle_L']);
    expect(rows[0]!.focus.map((node) => node.name)).toEqual(['Thumb_L', 'Index_L', 'Middle_L']);
  });

  it('keeps two of a kind as their own rows', () => {
    expect(titles([{ kind: 'shape', node: mesh('Rock') }, { kind: 'shape', node: mesh('Ledge') }])).toEqual(["Rock's shape changed", "Ledge's shape changed"]);
  });

  it('counts triangles as a budget reads them', () => {
    expect(titles([{ kind: 'triangles', node: mesh('Rock'), before: 180, after: 3024 }])).toEqual(['Rock: 180 → 3,024 triangles']);
  });

  it('names the material slot a rename leaves behind', () => {
    expect(changeRows([{ kind: 'slotRenamed', from: 'Wood', to: 'Wood_mat' }])[0]).toMatchObject({
      tone: 'risk',
      title: 'Material slot Wood is now Wood_mat',
      detail: "Unity remaps materials by slot name: the material set for the old name isn't used anymore.",
    });
  });

  it('tells the exporting app as a note', () => {
    expect(changeRows([{ kind: 'exporter', before: 'Blender 4.2.1', after: 'Blender 4.2.3' }])[0]).toMatchObject({ tone: 'note', title: 'Exported from Blender 4.2.3, was Blender 4.2.1' });
  });
});

describe('changeRows, for the import settings', () => {
  it('tells a Scale Factor changed, and Convert Units turned off alone', () => {
    expect(titles([{ kind: 'scaleFactor', before: { scaleFactor: 1, convertUnits: true }, after: { scaleFactor: 100, convertUnits: true } }])).toEqual(['Scale Factor in the import settings: 1 → 100']);
    expect(titles([{ kind: 'scaleFactor', before: { scaleFactor: 1, convertUnits: true }, after: { scaleFactor: 1, convertUnits: false } }])).toEqual(['Convert Units turned off in the import settings']);
  });

  it("tells what the settings ask of the model that it doesn't have, as risks", () => {
    const rows = changeRows([
      { kind: 'remapLost', slot: 'Wood' },
      { kind: 'clipPastTake', clip: 'Wave', take: 'Wave', lastFrame: 36, takeFrames: 24 },
      { kind: 'clipTakeLost', clip: 'Jump', take: 'Jump' },
    ]);
    expect(rows.map((row) => [row.tone, row.title])).toEqual([
      ['risk', "The material remapped to Wood isn't used"],
      ['risk', "Clip Wave ends at frame 36, past its take's 24 frames"],
      ['risk', 'Clip Jump is cut from the take Jump, which is gone'],
    ]);
  });

  it("folds a Humanoid avatar's lost bones into one row", () => {
    const lost = ['LeftHand', 'LeftLowerArm', 'LeftUpperArm'].map((humanName): ModelChange => ({ kind: 'avatarBoneLost', humanName, boneName: `${humanName}_bone` }));
    const [row] = changeRows(lost);
    expect(row).toMatchObject({ tone: 'risk', title: 'The Humanoid avatar lost 3 of its bones' });
    expect(row!.items!.map((item) => item.label)).toEqual(['LeftHand → LeftHand_bone', 'LeftLowerArm → LeftLowerArm_bone', 'LeftUpperArm → LeftUpperArm_bone']);
  });
});

describe('formatLength', () => {
  it('picks the unit that keeps a length readable', () => {
    expect([180, 1.8, 0.45, 0.05, 0.005, 0.0004].map(formatLength)).toEqual(['180 m', '1.8 m', '45 cm', '5 cm', '5 mm', '0.4 mm']);
  });
});

describe('formatUnits', () => {
  it('names the units exporters use', () => {
    expect([1, 0.01, 0.0254].map(formatUnits)).toEqual(['metres', 'centimetres', 'inches']);
    expect(formatUnits(0.5)).toBe('50 cm units');
  });
});
