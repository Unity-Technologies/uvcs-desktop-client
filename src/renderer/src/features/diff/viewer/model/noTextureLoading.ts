import { Loader, LoadingManager, Texture } from 'three';

/**
 * A loading manager under which a model's loader reads nothing but the model's own bytes: every texture its materials
 * name goes to one handler that records the name and hands back an empty texture, and any other URL a loader would
 * fetch is turned into an empty one; only the file's own bytes load (`data:` URIs inline in it, `blob:` URLs the
 * loader makes of what it embeds), and the companions it is given (a glTF's `.bin`, read by the viewer). So a model never reaches the disk or the network, and
 * three's loaders run without a DOM: their own `TextureLoader` would create an `<img>`, which a worker hasn't.
 */
export function noTextureLoading(onTexture: (fileName: string) => void, companions: ReadonlyMap<string, string> = new Map()): LoadingManager {
  const manager = new LoadingManager();
  // A file the model needs beside it, given as a blob URL of its bytes (a glTF's `.bin`), by the name the model uses.
  manager.setURLModifier((url) => companions.get(decodedName(url)) ?? (isOwnBytes(url) ? url : 'data:,'));
  manager.addHandler(/./, new TextureNames(onTexture));
  return manager;
}

/**
 * A texture loader that loads nothing: FBXLoader takes the texture `load` returns, glTF's loader the one it calls back
 * with (`parseModel` routes every glTF texture here, embedded ones too, so none is decoded).
 */
export class TextureNames extends Loader<Texture> {
  constructor(private readonly onTexture: (fileName: string) => void) {
    super();
  }

  override load(url: string, onLoad?: (texture: Texture) => void): Texture {
    const texture = new Texture();
    // A texture embedded in the file comes as a blob URL the loader made: nothing names it, and nothing will read it.
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    else if (!isOwnBytes(url)) {
      this.onTexture(decodedName(fileNameOf(url)));
      // The path as the loader asked for it: what the file's materials tell of the texture (`textureSources`).
      texture.userData.path = decodedName(url);
    }
    onLoad?.(texture);
    return texture;
  }
}

/** A name as the file gives it, `%20` as a space (glTF writes URIs encoded); one that isn't validly encoded as written. */
function decodedName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function isOwnBytes(url: string): boolean {
  return url.startsWith('data:') || url.startsWith('blob:');
}

/** A texture's file name, whatever folder the artist's machine kept it in (`C:\Art\wood.png`, `textures/wood.png`). */
export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
