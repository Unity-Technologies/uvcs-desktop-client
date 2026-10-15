// A version's clay, wire, heat and ghost materials, shared by every mesh drawn alike: one clay material per slot name
// and emphasis, one wire material per emphasis, one heat and one ghost material. Each mesh owning its own made three
// refresh every material's uniforms (its studio light, its environment's turn) for each of a model's 3,000 parts in
// every frame; shared, it refreshes them once per material, as it draws a material's meshes one after another.

import { MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { colorsByHeat, fadesByHeat, heatScale } from './heatColors';
import type { Emphasis } from './meshEmphasis';

/** A clay material made, with the slot name it colors and its emphasis: what the look sets its color by. */
export interface Clay {
  material: MeshStandardMaterial;
  slot: string;
  emphasis: Emphasis;
}

/** How each mesh is drawn, apart from its color: the clay's offset leaves the wireframe drawn over it in front. */
const CLAY = { roughness: 0.72, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 } as const;

export class SceneMaterials {
  /** By emphasis and slot name. */
  private readonly clays = new Map<string, Clay>();
  private readonly wires = new Map<Emphasis, MeshBasicMaterial>();
  /** What the heat and ghost color by: the tolerance and the colors (`ModelRenderer.setHeatTolerance`, `applyLook`). */
  readonly heatScale = heatScale();
  /** The Differences mode's twins (`ModelScene` `heat`, `ghost`): every mesh's alike, colored on the GPU (`heatColors`). */
  readonly heat = new MeshStandardMaterial(CLAY);
  readonly ghost = new MeshBasicMaterial({ transparent: true, depthWrite: false });

  constructor() {
    colorsByHeat(this.heat, this.heatScale);
    fadesByHeat(this.ghost, this.heatScale);
  }

  /** The clay material of a slot of this name, drawn with this emphasis. */
  clay(slot: string, emphasis: Emphasis): MeshStandardMaterial {
    const key = `${emphasis}\0${slot}`;
    let clay = this.clays.get(key);
    if (!clay) {
      clay = { material: new MeshStandardMaterial({ name: slot, ...CLAY }), slot, emphasis };
      this.clays.set(key, clay);
    }
    return clay.material;
  }

  /** Each clay material made. */
  eachClay(): Clay[] {
    return [...this.clays.values()];
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
    for (const material of [...[...this.clays.values()].map(({ material }) => material), ...this.wires.values(), this.heat, this.ghost]) material.dispose();
  }
}
