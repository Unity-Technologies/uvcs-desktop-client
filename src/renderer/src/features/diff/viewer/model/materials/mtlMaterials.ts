// An OBJ's materials, which live in the `.mtl` file its `mtllib` line names: each material's diffuse color (`Kd`),
// dissolve (`d`, or `Tr` its opposite), diffuse texture (`map_Kd`), normal or bump texture and alpha texture, read
// through three's MTLLoader (its `materialsInfo`, the file's values by lowercase key: it makes no material and loads no
// texture until asked). A texture's options (`-s` scale, `-o` offset, `-bm` bump strength) come before its file name.

import { Color, SRGBColorSpace } from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { fileNameOf } from '../noTextureLoading';
import type { FileMaterial, TextureUse } from '../parsedModel';

/** The `.mtl` files an OBJ names (`mtllib Tree.mtl`), as OBJLoader reads the line: the rest of it is the name. */
export function objMaterialLibraries(objText: string): string[] {
  const names = [...objText.matchAll(/^mtllib[ \t]+(.+?)[ \t]*\r?$/gm)].map((match) => match[1]!);
  return [...new Set(names)];
}

type MtlInfo = Record<string, string | number[] | undefined>;

/** Each material the `.mtl` defines, by name. */
export function readMtlMaterials(text: string): FileMaterial[] {
  const materialsInfo = new MTLLoader().parse(text, '').materialsInfo as Record<string, MtlInfo>;
  return Object.values(materialsInfo).map(materialOf);
}

function materialOf(info: MtlInfo): FileMaterial {
  const diffuse = Array.isArray(info.kd) && info.kd.every(Number.isFinite) ? new Color().setRGB(info.kd[0]!, info.kd[1]!, info.kd[2]!, SRGBColorSpace) : new Color(1, 1, 1);
  const dissolve = numberOf(info.d) ?? (numberOf(info.tr) === undefined ? 1 : 1 - numberOf(info.tr)!);
  const alphaMap = textureOf(info.map_d);
  return {
    name: String(info.name ?? ''),
    color: [diffuse.r, diffuse.g, diffuse.b],
    opacity: dissolve,
    baseMap: textureOf(info.map_kd),
    normalMap: textureOf(info.norm ?? info.map_bump ?? info.bump),
    alpha: dissolve < 1 || alphaMap ? 'blend' : 'opaque',
    cutoff: 0.5,
    doubleSided: false,
  };
}

/** Options a texture line may hold before its file name, by how many values follow each. */
const OPTION_VALUES: Record<string, number> = { '-s': 3, '-o': 3, '-t': 3, '-bm': 1, '-blendu': 1, '-blendv': 1, '-boost': 1, '-mm': 2, '-texres': 1, '-clamp': 1, '-imfchan': 1, '-cc': 1, '-type': 1 };

function textureOf(value: MtlInfo[string]): TextureUse | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const words = value.trim().split(/\s+/);
  let repeat: [number, number] = [1, 1];
  let offset: [number, number] = [0, 0];
  let at = 0;
  while (at < words.length - 1 && OPTION_VALUES[words[at]!.toLowerCase()] !== undefined) {
    const option = words[at]!.toLowerCase();
    const values = optionValues(words, at + 1, option);
    if (option === '-s') repeat = [Number(values[0] ?? 1), Number(values[1] ?? 1)];
    if (option === '-o') offset = [Number(values[0] ?? 0), Number(values[1] ?? 0)];
    at += 1 + values.length;
  }
  const path = words.slice(at).join(' ');
  return { texture: { kind: 'named', name: fileNameOf(path), storedPaths: [path] }, repeat, offset, rotation: 0, channel: 0 };
}

/**
 * The values an option takes from `start`, never the last word (the file name): `-s`, `-o` and `-t` take one to three,
 * as many as are numbers; the others their fixed count.
 */
function optionValues(words: string[], start: number, option: string): string[] {
  const most = Math.min(OPTION_VALUES[option]!, words.length - 1 - start);
  if (option !== '-s' && option !== '-o' && option !== '-t') return words.slice(start, start + Math.max(most, 0));
  let count = 0;
  while (count < most && isNumeric(words[start + count]!)) count++;
  return words.slice(start, start + count);
}

function isNumeric(word: string): boolean {
  return word.trim() !== '' && Number.isFinite(Number(word));
}

function numberOf(value: MtlInfo[string]): number | undefined {
  const number = typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(number) ? number : undefined;
}
