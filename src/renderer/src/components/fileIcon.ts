import { fileExtensions, fileNames, light } from 'material-icon-theme/dist/material-icons.json';

/** A file's icon in Material Icon Theme, by its name there: one for dark themes, and its variant for light ones. */
export interface FileIcon {
  dark: string;
  light: string;
}

/** What the theme doesn't know: Unity's serialized assets and Plastic's own configuration files. */
const OWN_EXTENSIONS: Record<string, string> = {
  ...Object.fromEntries(
    'prefab mat asset anim controller overridecontroller physicmaterial physicsmaterial2d mask playable spriteatlas terrainlayer lighting mixer rendertexture cubemap vfx asmdef asmref inputactions'
      .split(' ')
      .map((extension) => [extension, 'unity']),
  ),
  shadergraph: 'shader',
  shadersubgraph: 'shader',
  uxml: 'xml',
  uss: 'css',
  hdr: 'image',
  dylib: 'dll',
};
const OWN_NAMES: Record<string, string> = Object.fromEntries(
  ['ignore.conf', 'cloaked.conf', 'hidden_changes.conf', 'writable.conf', 'readonly.conf'].map((name) => [name, 'plastic']),
);

/** The theme's names match whatever their case, as in VS Code. */
const byLowerCase = (icons: Record<string, string>): Map<string, string> =>
  new Map(Object.entries(icons).map(([key, icon]) => [key.toLowerCase(), icon]));

const DARK = { names: byLowerCase({ ...fileNames, ...OWN_NAMES }), extensions: byLowerCase({ ...fileExtensions, ...OWN_EXTENSIONS }) };
const LIGHT = { names: byLowerCase(light.fileNames), extensions: byLowerCase(light.fileExtensions) };

/**
 * The icon of a file by its name or else its longest known extension (`d.ts` before `ts`), as Material Icon Theme
 * gives it in VS Code; `null` for a file it has no icon for (a Unity `.meta` file, an unknown extension), which the
 * plain page stands for.
 */
export function fileIconOf(fileName: string): FileIcon | null {
  const name = fileName.toLowerCase();
  const named = DARK.names.get(name);
  if (named) return { dark: named, light: LIGHT.names.get(name) ?? named };
  for (let dot = name.indexOf('.'); dot !== -1; dot = name.indexOf('.', dot + 1)) {
    const extension = name.slice(dot + 1);
    const icon = DARK.extensions.get(extension);
    if (icon) return { dark: icon, light: LIGHT.extensions.get(extension) ?? icon };
  }
  return null;
}
