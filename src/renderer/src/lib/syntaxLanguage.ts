import { getFiletypeFromFileName, type SupportedLanguages } from '@pierre/diffs';

/**
 * Extensions Pierre doesn't know but whose files have a well-known syntax: SVG is XML, and Unity's serialized assets
 * (the .meta next to every file, scenes, prefabs, materials…) are YAML.
 */
const KNOWN_SYNTAX: Record<string, SupportedLanguages> = {
  svg: 'xml',
  meta: 'yaml',
  unity: 'yaml',
  prefab: 'yaml',
  asset: 'yaml',
  mat: 'yaml',
  anim: 'yaml',
  controller: 'yaml',
  overrideController: 'yaml',
  physicMaterial: 'yaml',
  playable: 'yaml',
};

/** The language to highlight a file as, from its name. */
export function syntaxLanguage(fileName: string): SupportedLanguages {
  const extension = fileName.slice(fileName.lastIndexOf('.') + 1);
  return KNOWN_SYNTAX[extension] ?? KNOWN_SYNTAX[extension.toLowerCase()] ?? getFiletypeFromFileName(fileName);
}
