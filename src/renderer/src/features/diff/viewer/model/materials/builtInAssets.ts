// Unity's own assets, which no `.meta` in a project names: a `.meta` remap or a material's texture may point at them
// (Default-Material, Default-Diffuse, Sprites-Default, the default textures) by these GUIDs. They are always there, so
// never looked up and never missing.

/** `unity_builtin_extra` (Default-Material and the like) and `unity default resources`. */
const BUILT_IN_GUIDS = new Set(['0000000000000000f000000000000000', '0000000000000000e000000000000000']);

export function isBuiltInGuid(guid: string): boolean {
  return BUILT_IN_GUIDS.has(guid.toLowerCase());
}
