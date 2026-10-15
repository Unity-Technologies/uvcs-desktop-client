import { describe, expect, it } from 'vitest';
import { changeRows, takeOfPick } from './modelChangeWords';
import type { ModelChange, NodeRef } from './modelChanges';
import { formatLength, formatUnits } from './modelUnits';
import type { MaterialChange } from './materials/materialChanges';

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

  it('tells a mesh triangulated differently apart from a shape change, as its vertices stayed', () => {
    expect(changeRows([{ kind: 'triangulation', node: mesh('Cap') }])).toMatchObject([{ tone: 'note', title: 'Cap is triangulated differently', detail: 'Its vertices are where they were.' }]);
  });

  it('tells faces that use another material slot, folding three or more meshes', () => {
    expect(titles([{ kind: 'faceSlots', node: mesh('Body') }])).toEqual(["Some of Body's faces use another material"]);
    expect(titles(['Body', 'Door', 'Hood'].map((name): ModelChange => ({ kind: 'faceSlots', node: mesh(name) })))).toEqual(['Faces use other materials on 3 meshes']);
  });

  it('tells faces flipped by what Unity shows of them', () => {
    expect(changeRows([{ kind: 'facesFlipped', node: mesh('Hull') }])).toMatchObject([{ tone: 'note', title: "Some of Hull's faces flipped", detail: 'Unity draws a face from its front only: from outside, those look missing.' }]);
  });

  it('tells blendshapes resculpted and vertex colors repainted, naming the mesh', () => {
    expect(titles([{ kind: 'blendShapesChanged', node: mesh('Face'), names: ['Smile'] }])).toEqual(['Blendshape Smile on Face changed']);
    expect(titles([{ kind: 'blendShapesChanged', node: mesh('Face'), names: ['Smile', 'Blink', 'Frown', 'Pout'] }])).toEqual(['Blendshapes changed on Face: Smile, Blink, Frown and 1 more']);
    expect(titles([{ kind: 'vertexColorsChanged', node: mesh('Rock') }])).toEqual(["Rock's vertex colors changed"]);
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

  it('tells a take whose keys changed by the nodes it moves differently, and plays that take when picked', () => {
    const [row] = changeRows([{ kind: 'clipKeys', name: 'Run', nodes: [bone('Hips'), bone('Leg_L'), bone('Leg_R'), bone('Tail'), bone('Ear_L')] }]);
    // Its focus is none: a bone's dot stands where the bone rests, while the take plays it elsewhere.
    expect(row).toMatchObject({ tone: 'note', title: 'Animation Run changed: Hips, Leg_L, Leg_R and 2 more', take: 'Run', focus: [] });
    expect(titles([{ kind: 'clipKeys', name: 'Walk', nodes: [bone('Tail')] }])).toEqual(['Animation Walk changed: Tail']);
    expect(titles([{ kind: 'clipKeys', name: 'Wave', nodes: [] }])).toEqual(['Animation Wave changed']);
  });

  it('folds three or more takes whose keys changed, each item playing its own take', () => {
    const rows = changeRows(['Run', 'Walk', 'Wave'].map((name): ModelChange => ({ kind: 'clipKeys', name, nodes: [bone('Hips'), bone('Tail')] })));
    expect(rows).toMatchObject([{ title: '3 animations changed', focus: [] }]);
    expect(rows[0]!.take).toBeUndefined();
    expect(rows[0]!.items).toEqual([
      { label: 'Run: Hips, Tail', focus: [], take: 'Run' },
      { label: 'Walk: Hips, Tail', focus: [], take: 'Walk' },
      { label: 'Wave: Hips, Tail', focus: [], take: 'Wave' },
    ]);
  });

  it('plays the take a row or an item picked is about, and leaves the take bar alone for any other', () => {
    const [one] = changeRows([{ kind: 'clipKeys', name: 'Run', nodes: [] }]);
    const [folded] = changeRows(['Run', 'Walk', 'Wave'].map((name): ModelChange => ({ kind: 'clipKeys', name, nodes: [] })));
    const [shape] = changeRows([{ kind: 'shape', node: mesh('Rock') }]);
    expect(takeOfPick(one!)).toBe('Run');
    expect(takeOfPick(folded!, 1)).toBe('Walk');
    expect(takeOfPick(folded!)).toBeNull();
    expect(takeOfPick(shape!)).toBeNull();
  });

  it('tells textures renamed or changed with the meshes that show them as the focus, saying where a repaint shows', () => {
    const [renamed] = changeRows([{ kind: 'textures', added: ['Leaves_Autumn'], removed: ['Leaves_Summer'], nodes: [mesh('Leaves')] }]);
    expect(renamed).toMatchObject({ tone: 'note', title: 'Textures changed: Leaves_Summer → Leaves_Autumn', focus: [{ name: 'Leaves' }] });
    const [repainted] = changeRows([{ kind: 'embeddedTextures', names: ['Leaves'], nodes: [mesh('Leaves'), mesh('Bush')] }]);
    expect(repainted).toMatchObject({ title: 'Texture Leaves changed', detail: 'Show materials and textures to see it.', focus: [{ name: 'Leaves' }, { name: 'Bush' }] });
    expect(titles([{ kind: 'embeddedTextures', names: ['Leaves', 'Bark'], nodes: [] }])).toEqual(['2 textures changed: Leaves, Bark']);
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

describe('changeRows, for the materials', () => {
  const material = (change: MaterialChange, nodes: NodeRef[] = []): ModelChange => ({ kind: 'material', change, nodes });
  const project = (name: string, path = `Assets/Materials/${name}.mat`) => ({ kind: 'project' as const, guid: path, name, path });
  const DEFAULT = { kind: 'default' as const };

  it('focuses the meshes that use the slot, a folded row all of them and each item its own', () => {
    const [one] = changeRows([material({ kind: 'baseColor', slot: 'Main', before: '#CA9337', after: '#3881E1' }, [mesh('Body'), mesh('Arm')])]);
    expect(one!.focus.map((node) => node.name)).toEqual(['Body', 'Arm']);
    const [folded] = changeRows(['Glass', 'Visor', 'Lamp'].map((slot) => material({ kind: 'alpha', slot, before: 'opaque', after: 'blend' }, [mesh(slot)])));
    expect(folded!.focus.map((node) => node.name)).toEqual(['Glass', 'Visor', 'Lamp']);
    expect(folded!.items!.map((item) => item.focus.map((node) => node.name))).toEqual([['Glass'], ['Visor'], ['Lamp']]);
  });

  it('tells where a slot takes its material from now, and from where before', () => {
    const rows = changeRows([
      material({ kind: 'source', slot: 'Metal', before: DEFAULT, after: project('Lantern_Metal') }),
      material({ kind: 'source', slot: 'Body', before: { kind: 'file', name: 'Body' }, after: DEFAULT }),
      material({ kind: 'source', slot: 'Ball', before: project('Ball_Planks'), after: { kind: 'file', name: 'Ball' } }),
    ]);
    expect(rows.map((row) => [row.tone, row.title, row.detail])).toEqual([
      ['note', "Metal now uses the project's Lantern_Metal", "Was Unity's default material."],
      ['note', "Body now uses Unity's default material", "Was the model's own material."],
      ['note', "Ball now uses the model's own material", "Was the project's Ball_Planks."],
    ]);
  });

  it("names a material of a registry package, which Unity keeps in Library/PackageCache, the package's", () => {
    const lit = project('Lit', 'Game/Library/PackageCache/com.unity.render-pipelines.universal@17.0.3/Runtime/Materials/Lit.mat');
    expect(changeRows([material({ kind: 'source', slot: 'Glass', before: project('Lantern_Glass'), after: lit })])[0]).toMatchObject({
      title: "Glass now uses the package's Lit",
      detail: "Was the project's Lantern_Glass.",
    });
    expect(changeRows([material({ kind: 'source', slot: 'Glass', before: lit, after: DEFAULT })])[0]!.detail).toBe("Was the package's Lit.");
    // A folder of the project's Assets that happens to be named so is the project's.
    const odd = project('Lit', 'Game/Assets/Vendor/Library/PackageCache/Lit.mat');
    expect(changeRows([material({ kind: 'source', slot: 'Glass', before: DEFAULT, after: odd })])[0]!.title).toBe("Glass now uses the project's Lit");
  });

  it('names a project material by its folder too where another of its name was', () => {
    const [row] = changeRows([material({ kind: 'source', slot: 'Ball', before: project('Wood', 'Assets/Props/Wood.mat'), after: project('Wood', 'Assets/Balls/Wood.mat') })]);
    expect(row).toMatchObject({ title: "Ball now uses the project's Assets/Balls/Wood", detail: "Was the project's Assets/Props/Wood." });
  });

  it("tells a slot now showing Unity's missing material as a risk", () => {
    expect(changeRows([material({ kind: 'source', slot: 'Glass', before: project('Lantern_Glass'), after: { kind: 'missing' } })])[0]).toMatchObject({
      tone: 'risk',
      title: "Glass now shows Unity's missing material",
      detail: "It's remapped to a material the project doesn't have. Was the project's Lantern_Glass.",
    });
  });

  it('folds three or more slots taking their materials from one place, naming each', () => {
    const slots = ['Metal', 'Glass', 'Candle'].map((slot) => material({ kind: 'source', slot, before: DEFAULT, after: project(`Lantern_${slot}`) }));
    const [row] = changeRows(slots);
    expect(row).toMatchObject({ tone: 'note', title: "3 slots now use the project's materials" });
    expect(row!.detail).toBeUndefined();
    expect(row!.items!.map((item) => item.label)).toEqual(['Metal: Lantern_Metal', 'Glass: Lantern_Glass', 'Candle: Lantern_Candle']);
  });

  it('tells what changed within a material in a few words, naming the slot', () => {
    expect(
      titles([
        material({ kind: 'baseMap', slot: 'Wood', before: 'planks.png', after: 'rock.png' }),
        material({ kind: 'baseMap', slot: 'Bark', before: null, after: 'bark.png' }),
        material({ kind: 'normalMap', slot: 'Wood', before: 'planks_n.png', after: null }),
        material({ kind: 'baseColor', slot: 'Paint', before: '#C8A27A', after: '#8B5A2B' }),
        material({ kind: 'alpha', slot: 'Glass', before: 'opaque', after: 'blend' }),
        material({ kind: 'alpha', slot: 'Net', before: 'clip', after: 'opaque' }),
        material({ kind: 'cutoff', slot: 'Fern', before: 0.5, after: 0.8 }),
        material({ kind: 'doubleSided', slot: 'Leaf', now: true }),
        material({ kind: 'opacity', slot: 'Visor', before: 0.4, after: 0.6 }),
        material({ kind: 'tiling', slot: 'Floor', before: { repeat: [1, 1], offset: [0, 0] }, after: { repeat: [2, 2], offset: [0, 0] } }),
        material({ kind: 'tiling', slot: 'Wall', before: { repeat: [1, 1], offset: [0, 0] }, after: { repeat: [1, 1], offset: [0.5, 0] } }),
      ]),
    ).toEqual([
      'Wood: base map planks.png → rock.png',
      'Bark: base map bark.png added',
      'Wood: normal map planks_n.png removed',
      'Paint: base color #C8A27A → #8B5A2B',
      'Glass: now transparent',
      'Net: now opaque',
      'Fern: alpha cutoff 0.5 → 0.8',
      'Leaf: now double-sided',
      'Visor: opacity 40% → 60%',
      'Floor: base map tiling 1 × 1 → 2 × 2',
      'Wall: base map offset 0, 0 → 0.5, 0',
    ]);
  });

  it('folds three or more slots whose materials turned the same way, counting slots as it says', () => {
    const [row] = changeRows(['Glass', 'Visor', 'Bottle'].map((slot) => material({ kind: 'alpha', slot, before: 'opaque', after: 'blend' })));
    expect(row).toMatchObject({ title: '3 slots now transparent' });
    const maps = ['Wood', 'Bark', 'Plank'].map((slot) => material({ kind: 'baseMap', slot, before: 'a.png', after: 'b.png' }));
    expect(changeRows(maps)[0]!.title).toBe('Base map changed in 3 slots');
    expect(row!.items!.map((item) => item.label)).toEqual(['Glass', 'Visor', 'Bottle']);
  });

  it("tells materials it couldn't compare as a note, with what keeps it from it in plain words", () => {
    expect(changeRows([{ kind: 'materialsNotCompared', reason: 'noLibrary' }])[0]).toMatchObject({
      tone: 'note',
      title: 'Materials not compared',
      detail: 'Open the project in Unity once on this computer to compare them.',
    });
    expect(changeRows([{ kind: 'materialsNotCompared', reason: 'unread' }])[0]!.detail).toBe("The project's files couldn't all be read.");
    expect(changeRows([{ kind: 'materialsNotCompared', reason: 'noProject' }])[0]!.detail).toBe("The model isn't in a Unity project.");
    expect(changeRows([{ kind: 'materialsNotCompared', reason: 'outsidePackage' }])[0]!.detail).toBe("The project uses a package from a folder outside it, which isn't read.");
  });

  it("tells a texture the workspace lacks as a risk, and folds three of them", () => {
    expect(changeRows([material({ kind: 'textureMissing', slot: 'Wood', texture: 'planks.png' })])[0]).toMatchObject({
      tone: 'risk',
      title: "Wood: planks.png isn't in the workspace",
      detail: 'Unity shows the material without it.',
    });
    expect(titles([material({ kind: 'textureMissing', slot: 'Glass', texture: "Glass's base map" })])).toEqual(["Glass's base map isn't in the workspace"]);
    const gone = ['a.png', 'b.png', 'c.png'].map((texture) => material({ kind: 'textureMissing', slot: 'Wood', texture }));
    expect(changeRows(gone)[0]).toMatchObject({ tone: 'risk', title: "3 textures the materials use aren't in the workspace" });
    // Counted once each, however many slots use them.
    const shared = ['Wood', 'Bark', 'Plank'].map((slot) => material({ kind: 'textureMissing', slot, texture: 'planks.png' }));
    expect(changeRows(shared)[0]).toMatchObject({ tone: 'risk', title: "planks.png isn't in the workspace, for 3 slots" });
    // Its slots counted once each too: one slot using it as its base map and normal map is one slot.
    const twice = [...shared, material({ kind: 'textureMissing', slot: 'Wood', texture: 'planks.png' })];
    expect(changeRows(twice)[0]!.title).toBe("planks.png isn't in the workspace, for 3 slots");
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
