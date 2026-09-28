/**
 * A family of files, told apart by their icon: what you write (source, scripts), what builds it (project and build
 * files), what's generated for you (lockfiles, Unity's .meta files, designer code), and the rest by what it holds.
 */
export type FileFamily =
  | 'source'
  | 'script'
  | 'project'
  | 'config'
  | 'generated'
  | 'docs'
  | 'image'
  | 'media'
  | 'asset'
  | 'archive'
  | 'binary'
  | 'plain';

type Known = Exclude<FileFamily, 'plain'>;

/** Well-known names, matched first: `package.json` builds a project, `package-lock.json` is generated. */
const NAMES: Partial<Record<Known, string>> = {
  script: 'gradlew',
  project:
    'package.json cargo.toml cmakelists.txt makefile gnumakefile dockerfile containerfile docker-compose.yml docker-compose.yaml compose.yml compose.yaml build.gradle.kts settings.gradle.kts pom.xml go.mod pyproject.toml setup.py setup.cfg requirements.txt pipfile gemfile podfile global.json nuget.config tsconfig.json jsconfig.json manifest.json',
  config: '.gitignore .gitattributes .editorconfig .npmrc .env ignore.conf cloaked.conf hidden_changes.conf writable.conf readonly.conf',
  generated:
    'package-lock.json yarn.lock pnpm-lock.yaml npm-shrinkwrap.json bun.lockb cargo.lock gemfile.lock podfile.lock poetry.lock pipfile.lock composer.lock packages.lock.json packages-lock.json go.sum flake.lock',
  docs: 'readme license licence changelog authors notice copying',
};

/** Extensions, the longest matched first: `designer.cs` is generated, `cs` is source. */
const EXTENSIONS: Record<Known, string> = {
  source:
    'cs ts tsx mts cts js jsx mjs cjs c cc cpp cxx h hh hpp hxx inl ipp m mm py pyi rb go rs java kt kts swift scala php lua dart fs fsx fsi vb shader hlsl hlsli glsl cginc compute usf ush css scss sass less uss html htm vue svelte xaml uxml razor cshtml sql graphql gql proto r jl ex exs erl hs clj zig nim',
  script: 'sh bash zsh fish ps1 psm1 bat cmd',
  project:
    'csproj vbproj fsproj vcxproj vcxitems shproj sln slnx slnf props targets gradle cmake mk asmdef asmref nuspec podspec gemspec bazel bzl',
  config: 'json jsonc json5 yaml yml toml ini cfg conf config xml plist properties env csv tsv resx inputactions',
  generated:
    'meta lock g.cs g.i.cs designer.cs generated.cs aspx.designer.cs min.js min.css map pb.go pb.cc pb.h pyc vcxproj.filters vcxproj.user csproj.user suo',
  docs: 'md markdown mdx txt rst adoc rtf pdf doc docx odt xls xlsx ods ppt pptx odp log tex',
  image: 'png jpg jpeg gif bmp webp psd psb tga tif tiff exr hdr ico icns svg dds ktx ktx2 heic avif ai sketch fig kra xcf',
  media: 'wav mp3 ogg flac aif aiff m4a aac mp4 mov avi webm mkv m4v',
  asset:
    'unity prefab mat asset anim controller overridecontroller physicmaterial physicsmaterial2d mask playable spriteatlas spriteatlasv2 terrainlayer lighting mixer rendertexture cubemap flare guiskin fontsettings brush vfx shadergraph shadersubgraph unitypackage fbx obj blend dae 3ds max ma mb gltf glb usd usda usdc usdz abc uasset umap',
  archive: 'zip tar gz tgz bz2 xz zst 7z rar nupkg jar war apk aab ipa',
  binary: 'dll exe so dylib a lib o pdb bin dat wasm class ttf otf woff woff2 msi pak',
};

const lookup = (lists: Partial<Record<Known, string>>): Map<string, Known> =>
  new Map(
    Object.entries(lists).flatMap(([family, keys]) =>
      (keys ?? '').split(' ').map((key) => [key, family as Known] as const),
    ),
  );

const BY_NAME = lookup(NAMES);
const BY_EXTENSION = lookup(EXTENSIONS);

/**
 * The family of a file by its name, whatever its case, or else its longest known extension (`Form.Designer.cs` is
 * generated, `Form.cs` source); `plain` for anything else.
 */
export function fileFamilyOf(fileName: string): FileFamily {
  const name = fileName.toLowerCase();
  const named = BY_NAME.get(name);
  if (named) return named;
  for (let dot = name.indexOf('.', 1); dot !== -1; dot = name.indexOf('.', dot + 1)) {
    const family = BY_EXTENSION.get(name.slice(dot + 1));
    if (family) return family;
  }
  return 'plain';
}
