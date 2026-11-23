/**
 * The names a 3D exporter gives a part nobody named: a generic word alone or with a number after it, or a number alone
 * ("Mesh", "mesh_0", "Object_12", "polySurface3", "pCube1", "node_5", Blender's "Cube.001"). Kept short on purpose: a
 * name it misses still reads, and one it wrongly took would hide what an artist wrote.
 */
const EXPORTER_NAME = /^(?:mesh|object|node|geometry|group|primitive|polysurface|p?cube|p?sphere|p?cylinder|p?plane|default|untitled|root|rootnode|scene)?(?:[\s._-]*\d+)*$/i;

/** Whether a part's name tells a reader nothing about it, so a comment's place doesn't show it (`writtenPlaceText`). */
export function partNameSaysNothing(name: string): boolean {
  return EXPORTER_NAME.test(name.trim());
}
