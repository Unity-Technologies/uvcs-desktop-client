import { BackSide, BoxGeometry, DoubleSide, FrontSide, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShaderMaterial, type BufferGeometry, type Camera, type Scene, type WebGLRenderer } from 'three';
import { describe, expect, it } from 'vitest';
import { facesOf, MeshPicker } from './meshPicker';

describe('facesOf', () => {
  it("picks the faces the mesh's material draws: the front, the back or both", () => {
    expect([FrontSide, BackSide, DoubleSide].map((side) => facesOf(new MeshStandardMaterial({ side }), null))).toEqual([0, 1, 2]);
  });

  it("reads a mesh of several slots by the slot drawn, as a leaf card's double-sided slot beside a trunk's", () => {
    const slots = [new MeshStandardMaterial(), new MeshStandardMaterial({ side: DoubleSide })];
    expect([facesOf(slots, { materialIndex: 0 }), facesOf(slots, { materialIndex: 1 })]).toEqual([0, 2]);
  });
});

describe('facesOf, wireframe', () => {
  it('picks both sides of a part drawn as wireframe, whose lines show from both', () => {
    expect(facesOf(new MeshBasicMaterial({ wireframe: true }), null)).toBe(2);
  });
});

describe('MeshPicker.makePickable', () => {
  it('tells the picking pass which mesh and which faces it draws, and leaves every other draw alone', () => {
    const slots = [new MeshStandardMaterial(), new MeshStandardMaterial({ side: DoubleSide })];
    const mesh = new Mesh(new BoxGeometry(), slots);
    MeshPicker.makePickable([mesh], 4);
    const picking = new ShaderMaterial({ uniforms: { mesh: { value: 0 }, faces: { value: 0 } } });
    picking.userData.picks = true;
    const draw = (material: ShaderMaterial | MeshStandardMaterial, materialIndex: number) =>
      mesh.onBeforeRender({} as WebGLRenderer, {} as Scene, {} as Camera, mesh.geometry as BufferGeometry, material, { start: 0, count: 3, materialIndex } as never);
    draw(picking, 1);
    expect([picking.uniforms.mesh!.value, picking.uniforms.faces!.value, picking.uniformsNeedUpdate]).toEqual([5, 2, true]);
    const other = new ShaderMaterial({ uniforms: { mesh: { value: 0 } } });
    draw(other, 1);
    expect(other.uniforms.mesh!.value).toBe(0);
  });
});
