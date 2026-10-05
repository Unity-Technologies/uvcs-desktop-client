import { Loader, LoadingManager, Texture } from 'three';

/**
 * A loading manager under which a model's loader reads nothing but the model's own bytes: every texture its materials
 * name goes to one handler that records the name and hands back an empty texture, and any other URL a loader would
 * fetch (a glTF's external buffer) is turned into an empty one; only the file's own bytes load (`data:` URIs inline in
 * it, `blob:` URLs the loader makes of what it embeds). So a model never reaches the disk or the network, and
 * three's loaders run without a DOM: their own `TextureLoader` would create an `<img>`, which a worker hasn't.
 */
export function noTextureLoading(onTexture: (fileName: string) => void): LoadingManager {
  const manager = new LoadingManager();
  manager.setURLModifier((url) => (isOwnBytes(url) ? url : 'data:,'));
  manager.addHandler(/./, new TextureNames(onTexture));
  return manager;
}

/** A texture loader that loads nothing: FBXLoader takes the texture `load` returns, glTF's loader the one it calls back with. */
class TextureNames extends Loader<Texture> {
  constructor(private readonly onTexture: (fileName: string) => void) {
    super();
  }

  override load(url: string, onLoad?: (texture: Texture) => void): Texture {
    // A texture embedded in the file comes as a blob URL the loader made: nothing names it, and nothing will read it.
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    else if (!isOwnBytes(url)) this.onTexture(fileNameOf(url));
    const texture = new Texture();
    onLoad?.(texture);
    return texture;
  }
}

function isOwnBytes(url: string): boolean {
  return url.startsWith('data:') || url.startsWith('blob:');
}

/** A texture's file name, whatever folder the artist's machine kept it in (`C:\Art\wood.png`, `textures/wood.png`). */
export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
