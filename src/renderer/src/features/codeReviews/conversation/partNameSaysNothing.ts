/**
 * The names a 3D exporter gives a part nobody named: a generic word alone or with a number after it, or a number alone
 * ("Mesh", "mesh_0", "Object_12", "polySurface3", "node_5"), and a primitive shape only in an exporter's own form,
 * Maya's "pCylinder3" or Blender's "Cube.001": a bare "Plane" or "Sphere" may be what an artist called it. Kept short
 * on purpose: a name it misses still reads, and one it wrongly took would hide what an artist wrote.
 *
 * Each repetition takes one digit (`(?:[\s._-]*\d)*`), so a long run of digits is read once, never retried in every
 * split.
 */
const GENERIC_NAME = /^(?:mesh|object|node|geometry|group|primitive|polysurface|default|untitled|root|rootnode|scene)?(?:[\s._-]*\d)*$/i;
const MAYA_SHAPE = /^p(?:cube|sphere|cylinder|plane|cone|torus)\d*$/i;
const BLENDER_SHAPE = /^(?:cube|sphere|cylinder|plane|cone|torus|icosphere)\.\d+$/i;

/** Whether a part's name tells a reader nothing about it, so a comment's place doesn't show it (`writtenPlaceText`). */
export function partNameSaysNothing(name: string): boolean {
  const trimmed = name.trim();
  return GENERIC_NAME.test(trimmed) || MAYA_SHAPE.test(trimmed) || BLENDER_SHAPE.test(trimmed);
}
