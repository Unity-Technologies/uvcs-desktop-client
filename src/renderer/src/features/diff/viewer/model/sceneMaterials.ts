// A version's clay, wire, heat and ghost materials, shared by every mesh drawn alike: one clay material per slot name
// and emphasis, one wire material per emphasis, one heat and one ghost material. Each mesh owning its own made three
// refresh every material's uniforms (its studio light, its environment's turn) for each of a model's 3,000 parts in
// every frame; shared, it refreshes them once per material, as it draws a material's meshes one after another.

import { MeshBasicMaterial, MeshStandardMaterial } from 'three';

/** How a mesh stands out while some are picked: lit up, faded towards the backdrop, or neither. */
export type Emphasis = 'plain' | 'lit' | 'faded';

/** How each mesh is drawn, apart from its color: the clay's offset leaves the wireframe drawn over it in front. */
const CLAY = { roughness: 0.72, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 } as const;

export class SceneMaterials {
  private readonly clays = new Map<string, MeshStandardMaterial>();
  private readonly wires = new Map<Emphasis, MeshBasicMaterial>();
  /** The Differences mode's twins (`ModelScene` `heat`, `ghost`): every mesh's alike. */
  readonly heat = new MeshStandardMaterial({ vertexColors: true, ...CLAY });
  readonly ghost = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });

  /** The clay material of a slot of this name, drawn with this emphasis. */
  clay(slot: string, emphasis: Emphasis): MeshStandardMaterial {
    const key = `${emphasis}\0${slot}`;
    let material = this.clays.get(key);
    if (!material) {
      material = new MeshStandardMaterial({ name: slot, ...CLAY });
      material.userData = { slot, emphasis };
      this.clays.set(key, material);
    }
    return material;
  }

  /** Each clay material made, with the slot it colors and its emphasis: what the look sets their colors by. */
  eachClay(): { material: MeshStandardMaterial; slot: string; emphasis: Emphasis }[] {
    return [...this.clays.values()].map((material) => ({ material, slot: material.userData.slot as string, emphasis: material.userData.emphasis as Emphasis }));
  }

  wire(emphasis: Emphasis): MeshBasicMaterial {
    let material = this.wires.get(emphasis);
    if (!material) {
      material = new MeshBasicMaterial({ wireframe: true, transparent: true, depthWrite: false });
      this.wires.set(emphasis, material);
    }
    return material;
  }

  eachWire(): { material: MeshBasicMaterial; emphasis: Emphasis }[] {
    return [...this.wires].map(([emphasis, material]) => ({ material, emphasis }));
  }

  dispose(): void {
    for (const material of [...this.clays.values(), ...this.wires.values(), this.heat, this.ghost]) material.dispose();
  }
}

/** A mesh lit up when it or a node above it is picked; faded when others are picked and it isn't. */
export function emphasisOf(meshKey: string, picked: ReadonlySet<string>, anyPicked: boolean): Emphasis {
  const lit = picked.has(meshKey) || [...picked].some((key) => meshKey.startsWith(`${key}/`));
  return lit ? 'lit' : anyPicked ? 'faded' : 'plain';
}
