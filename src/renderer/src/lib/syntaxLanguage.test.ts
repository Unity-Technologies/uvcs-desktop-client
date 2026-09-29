import { EXTENSION_TO_FILE_FORMAT } from '@pierre/diffs';
// The grammars Pierre loads: its `resolveLanguage` takes them from Shiki's bundle.
import { bundledLanguages } from 'shiki';
import { describe, expect, it } from 'vitest';
import { MAPPED_LANGUAGES, syntaxLanguage } from './syntaxLanguage';

describe('syntaxLanguage', () => {
  it('only gives languages Pierre has a grammar for', () => {
    const languages = [...MAPPED_LANGUAGES, ...Object.values(EXTENSION_TO_FILE_FORMAT)];
    expect(languages.filter((language) => language !== undefined && !(language in bundledLanguages))).toEqual([]);
  });

  it('highlights .NET projects, build files and resources as XML', () => {
    for (const name of ['Core.csproj', 'App.vbproj', 'Lib.fsproj', 'native.vcxproj', 'native.vcxproj.filters']) {
      expect(syntaxLanguage(`src/${name}`)).toBe('xml');
    }
    for (const name of ['Directory.Build.props', 'Build.targets', 'Pkg.nuspec', 'Strings.resx', 'app.manifest']) {
      expect(syntaxLanguage(name)).toBe('xml');
    }
    expect(syntaxLanguage('web.config')).toBe('xml');
    expect(syntaxLanguage('MainWindow.xaml')).toBe('xml');
    expect(syntaxLanguage('App.axaml')).toBe('xml');
    expect(syntaxLanguage('.editorconfig')).toBe('ini');
    expect(syntaxLanguage('Program.fs')).toBe('fsharp');
    expect(syntaxLanguage('Index.cshtml')).toBe('razor');
    expect(syntaxLanguage('build.cake')).toBe('csharp');
  });

  it('highlights Unity assets as YAML, and its shaders, styles and definitions as what they are written in', () => {
    for (const name of ['Player.cs.meta', 'Main.unity', 'Hero.prefab', 'Grass.mat', 'Hero.overrideController']) {
      expect(syntaxLanguage(`Assets/${name}`)).toBe('yaml');
    }
    expect(syntaxLanguage('Assets/Bounce.physicsMaterial2D')).toBe('yaml');
    expect(syntaxLanguage('ProjectSettings/ProjectVersion.txt')).toBe('yaml');
    expect(syntaxLanguage('Assets/Water.shader')).toBe('shaderlab');
    expect(syntaxLanguage('Assets/Common.cginc')).toBe('hlsl');
    expect(syntaxLanguage('Assets/Blur.compute')).toBe('hlsl');
    expect(syntaxLanguage('Assets/Lit.shadergraph')).toBe('json');
    expect(syntaxLanguage('Assets/Game.asmdef')).toBe('json');
    expect(syntaxLanguage('Assets/Controls.inputactions')).toBe('json');
    expect(syntaxLanguage('Assets/UI/Menu.uss')).toBe('css');
    expect(syntaxLanguage('Assets/UI/Menu.uxml')).toBe('xml');
    expect(syntaxLanguage('Assets/icon.svg')).toBe('xml');
  });

  it('knows build files by their whole name, wherever they are', () => {
    expect(syntaxLanguage('docker/Dockerfile')).toBe('dockerfile');
    expect(syntaxLanguage('docker/Dockerfile.dev')).toBe('dockerfile');
    expect(syntaxLanguage('src/Makefile')).toBe('makefile');
    expect(syntaxLanguage('native/CMakeLists.txt')).toBe('cmake');
    expect(syntaxLanguage('Cargo.lock')).toBe('toml');
    expect(syntaxLanguage('Pipfile')).toBe('toml');
    expect(syntaxLanguage('ios/Podfile')).toBe('ruby');
    expect(syntaxLanguage('Gemfile')).toBe('ruby');
    expect(syntaxLanguage('Jenkinsfile')).toBe('groovy');
    expect(syntaxLanguage('tsconfig.json')).toBe('jsonc');
    expect(syntaxLanguage('.env.local')).toBe('dotenv');
    expect(syntaxLanguage('C:\\work\\game\\.gitignore')).toBe('codeowners');
    expect(syntaxLanguage('ignore.conf')).toBe('codeowners');
  });

  it('takes the longest extension first', () => {
    expect(syntaxLanguage('build.gradle')).toBe('groovy');
    expect(syntaxLanguage('build.gradle.kts')).toBe('kts');
    expect(syntaxLanguage('Core.csproj.user')).toBe('xml');
    expect(syntaxLanguage('.eslintrc.json')).toBe('json');
  });

  it('corrects what Pierre would pick for common files', () => {
    expect(syntaxLanguage('include/engine.h')).toBe('cpp');
    expect(syntaxLanguage('ios/AppDelegate.m')).toBe('objective-c');
    expect(syntaxLanguage('tools/build.pl')).toBe('perl');
  });

  it('leaves everything else to Pierre', () => {
    expect(syntaxLanguage('src/app.ts')).toBe('typescript');
    expect(syntaxLanguage('pom.xml')).toBe('xml');
    expect(syntaxLanguage('gradle.properties')).toBe('properties');
    expect(syntaxLanguage('deploy/nginx.conf')).toBe('nginx');
    expect(syntaxLanguage('go.mod')).toBe('text');
  });
});
