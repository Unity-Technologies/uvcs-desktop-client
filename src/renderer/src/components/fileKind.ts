/** A family of file types, told apart by their icon's glyph: code, images, Unity assets... */
export type FileKind = 'code' | 'data' | 'text' | 'image' | 'media' | 'archive' | 'asset' | 'binary' | 'meta' | 'plain';

const EXTENSIONS: Record<Exclude<FileKind, 'plain'>, string> = {
  code: 'cs ts tsx js jsx mjs cjs c cc cpp cxx h hh hpp hxx m mm py rb go rs java kt kts swift scala php lua sh bash zsh ps1 bat cmd shader hlsl glsl cginc compute css scss less uss html htm vue svelte sql gradle cmake fs vb dart',
  data: 'json jsonc yaml yml xml toml ini cfg conf config props targets csproj sln vcxproj plist asmdef asmref inputactions uxml',
  text: 'txt md markdown rst rtf pdf doc docx odt csv tsv xls xlsx log tex',
  image: 'png jpg jpeg gif bmp webp psd tga tif tiff exr hdr ico svg dds ktx heic avif',
  media: 'wav mp3 ogg flac aif aiff m4a mp4 mov avi webm mkv',
  archive: 'zip tar gz tgz bz2 xz 7z rar unitypackage nupkg jar apk ipa',
  // Unity's serialized assets and 3D models.
  asset: 'unity prefab asset mat anim controller overridecontroller physicmaterial mask playable spriteatlas terrainlayer lighting fbx obj blend dae 3ds max ma mb gltf glb usd usdz',
  binary: 'dll exe so dylib a lib o pdb bin dat wasm class pyc ttf otf woff woff2',
  meta: 'meta',
};

const KIND_BY_EXTENSION = new Map(
  Object.entries(EXTENSIONS).flatMap(([kind, extensions]) => extensions.split(' ').map((extension) => [extension, kind as FileKind] as const)),
);

/** The family of a file by its name's extension; `plain` for anything else (and names like `.gitignore`). */
export function fileKindOf(name: string): FileKind {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return 'plain';
  return KIND_BY_EXTENSION.get(name.slice(dot + 1).toLowerCase()) ?? 'plain';
}
