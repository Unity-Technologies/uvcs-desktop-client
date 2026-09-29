import { getFiletypeFromFileName, type BundledLanguage, type SupportedLanguages } from '@pierre/diffs';
import { lastSegment } from './paths';

/** Names or extensions by the language they're written in: lower case, looked up so, and each a grammar Pierre bundles. */
type LanguageTable = Partial<Record<BundledLanguage, string[]>>;

/**
 * Files whose name alone says their syntax, whatever their extension (or with none). Ignore lists get CODEOWNERS'
 * grammar, the one Pierre has for lines of patterns and `#` comments.
 */
const BY_NAME = {
  toml: ['cargo.lock', 'rust-toolchain', 'pipfile', 'poetry.lock', 'uv.lock'],
  json: ['pipfile.lock', 'package.resolved', '.watchmanconfig'],
  jsonc: ['tsconfig.json', 'jsconfig.json', '.babelrc', '.eslintrc', '.prettierrc', '.swcrc', '.jshintrc'],
  yaml: ['podfile.lock', 'projectversion.txt', '.clang-format', '.clang-tidy', '.clangd'],
  ini: ['.editorconfig', '.npmrc', '.gitconfig', '.gitmodules', '.flake8', '.pylintrc', '.coveragerc', 'conanfile.txt'],
  xml: ['.classpath', '.project'],
  codeowners: [
    '.gitignore', '.gitattributes', '.dockerignore', '.npmignore', '.eslintignore', '.prettierignore', '.hgignore',
    // Unity Version Control's own lists of paths.
    'ignore.conf', 'cloaked.conf', 'hidden_changes.conf', 'writable.conf', 'readonly.conf',
  ],
  dockerfile: ['containerfile'],
  make: ['gnumakefile'],
  just: ['justfile', '.justfile'],
  groovy: ['jenkinsfile'],
  python: ['sconstruct', 'sconscript', 'build.bazel', 'workspace.bazel'],
  ruby: [
    'podfile', 'fastfile', 'appfile', 'matchfile', 'pluginfile', 'deliverfile', 'snapfile', 'scanfile', 'gymfile',
    '.irbrc', '.pryrc',
  ],
  shellscript: [
    'gradlew', 'mvnw', '.envrc', '.bashrc', '.bash_profile', '.bash_logout', '.profile', '.zshrc', '.zprofile',
    '.zshenv',
  ],
} satisfies LanguageTable;

/** Names that start so, whatever follows: Dockerfile.dev, .env.local. */
const BY_NAME_START = {
  dockerfile: ['dockerfile.'],
  dotenv: ['.env.'],
} satisfies LanguageTable;

/** Extensions, the longest first (`gradle.kts` before `kts`), where Pierre knows none or picks another syntax. */
const BY_EXTENSION = {
  xml: [
    // .NET projects, build and package files, resources and UI.
    'csproj', 'vbproj', 'fsproj', 'vcxproj', 'vcxproj.filters', 'vcproj', 'sqlproj', 'dbproj', 'shproj', 'projitems',
    'wixproj', 'wxs', 'wxi', 'wxl', 'csproj.user', 'vcxproj.user', 'props', 'targets', 'nuspec', 'resx', 'resw',
    'config', 'manifest', 'appxmanifest', 'vsixmanifest', 'vsct', 'xaml', 'axaml', 'ruleset', 'runsettings',
    'testsettings', 'natvis', 'pubxml', 'slnx', 'edmx', 'dbml', 'rdl', 'rdlc', 'ps1xml',
    // Java, Apple, Unity's UI Toolkit, and XML under other names.
    'iml', 'tld', 'jnlp', 'plist', 'entitlements', 'storyboard', 'xib', 'xcscheme', 'xcworkspacedata', 'uxml', 'svg',
    'xsd', 'wsdl', 'xliff', 'xlf', 'rss', 'atom', 'kml', 'gpx',
  ],
  yaml: [
    // Unity's serialized assets.
    'meta', 'unity', 'prefab', 'asset', 'mat', 'anim', 'controller', 'overridecontroller', 'physicmaterial',
    'physicsmaterial', 'physicsmaterial2d', 'mask', 'flare', 'rendertexture', 'lighting', 'guiskin', 'fontsettings',
    'spriteatlas', 'spriteatlasv2', 'terrainlayer', 'mixer', 'playable', 'signal', 'preset', 'brush', 'cubemap',
    'giparams', 'scenetemplate', 'shadervariants', 'vfx', 'vfxoperator', 'vfxblock', 'wlt', 'dwlt', 'colors',
    'gradients', 'curves', 'curvesnormalized', 'particlecurves', 'particlecurvessigned', 'particledoublecurves',
    'particledoublecurvessigned',
  ],
  json: [
    // Unity's assembly definitions, input actions and Shader Graphs.
    'asmdef', 'asmref', 'inputactions', 'shadergraph', 'shadersubgraph',
    'ipynb', 'webmanifest', 'har', 'geojson', 'gltf', 'tfstate', 'sarif',
  ],
  jsonc: ['code-workspace'],
  css: ['uss', 'tss'],
  hlsl: ['cginc', 'compute', 'raytrace', 'hlslinc'],
  glsl: ['glslinc'],
  cpp: ['h', 'hxx', 'h++', 'c++', 'inl', 'ipp', 'tpp', 'tcc', 'ixx', 'cppm', 'ino', 'cu', 'cuh', 'metal'],
  'objective-c': ['m'],
  csharp: ['csx', 'cake'],
  groovy: ['gradle', 'jenkinsfile'],
  kts: ['gradle.kts'],
  scala: ['sbt'],
  html: ['jsp', 'aspx', 'ascx', 'master', 'xhtml'],
  javascript: ['jslib', 'jspre'],
  perl: ['pl'],
  python: ['bzl', 'bazel', 'star'],
  ruby: ['rbs'],
  gn: ['gn', 'gni'],
  make: ['mak', 'make'],
  shellscript: ['ksh', 'command'],
  just: ['just'],
  ron: ['ron'],
  kdl: ['kdl'],
  pkl: ['pkl'],
  odin: ['odin'],
  smithy: ['smithy'],
  hurl: ['hurl'],
  nsis: ['nsi', 'nsh'],
  ahk: ['ahk'],
  org: ['org'],
  openscad: ['scad'],
} satisfies LanguageTable;

/** The table turned into a key → language lookup. */
function lookup(table: Record<string, string[]>): Map<string, SupportedLanguages> {
  return new Map(Object.entries(table).flatMap(([language, keys]) => keys.map((key) => [key, language] as const)));
}

const LANGUAGE_BY_NAME = lookup(BY_NAME);
const LANGUAGE_BY_NAME_START = lookup(BY_NAME_START);
const LANGUAGE_BY_EXTENSION = lookup(BY_EXTENSION);

/** Every language `syntaxLanguage` gives besides Pierre's own, to check they're all in Pierre's bundle. */
export const MAPPED_LANGUAGES: ReadonlySet<SupportedLanguages> = new Set(
  [BY_NAME, BY_NAME_START, BY_EXTENSION].flatMap((table) => Object.keys(table)),
);

function byNameStart(name: string): SupportedLanguages | undefined {
  for (const [start, language] of LANGUAGE_BY_NAME_START) if (name.startsWith(start)) return language;
  return undefined;
}

/** For `a.gradle.kts`: `gradle.kts`, then `kts`. A name that starts with a dot is all extension (`.editorconfig`). */
function byLongestExtension(name: string): SupportedLanguages | undefined {
  for (let dot = name.indexOf('.'); dot !== -1; dot = name.indexOf('.', dot + 1)) {
    const language = LANGUAGE_BY_EXTENSION.get(name.slice(dot + 1));
    if (language) return language;
  }
  return undefined;
}

/**
 * The language to highlight a file as, from its path: by its whole name first (Dockerfile, Cargo.lock), then by its
 * longest extension, then as Pierre would ("text" when it doesn't know it either).
 */
export function syntaxLanguage(path: string): SupportedLanguages {
  const fileName = lastSegment(path);
  const name = fileName.toLowerCase();
  return (
    LANGUAGE_BY_NAME.get(name) ?? byNameStart(name) ?? byLongestExtension(name) ?? getFiletypeFromFileName(fileName)
  );
}
