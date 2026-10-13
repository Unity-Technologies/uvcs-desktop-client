import { describe, expect, it } from 'vitest';
import { preferredMatches, searchedFolders, textureCandidates, type TextureSearch } from './textureSearch';
import { unityProjectOf } from './unityProject';

const MODEL = 'Game/Assets/Art/Tree/Tree.fbx';

function search(overrides: Partial<TextureSearch> = {}): TextureSearch {
  const modelPath = overrides.modelPath ?? MODEL;
  return { modelPath, project: unityProjectOf(modelPath), name: 'bark.png', storedPaths: [], workspacePath: '/Users/ana/wk', platform: 'darwin', ...overrides };
}

describe('unityProjectOf', () => {
  it('finds the outermost folder with an Assets folder the model is under, whatever its case', () => {
    expect(unityProjectOf('Game/Assets/Art/Tree.fbx')).toEqual({ root: 'Game', assets: 'Game/Assets' });
    expect(unityProjectOf('assets/Tree.fbx')).toEqual({ root: '', assets: 'assets' });
    expect(unityProjectOf('SourceArt/Tree.fbx')).toBeNull();
    // A file named Assets is no folder the model is under.
    expect(unityProjectOf('Art/Assets')).toBeNull();
    // A vendor's package keeps an Assets folder of its own inside the project's: the project is the outer one.
    expect(unityProjectOf('Game/Assets/Vendor/Assets/Tree.fbx')).toEqual({ root: 'Game', assets: 'Game/Assets' });
  });
});

describe('textureCandidates', () => {
  it("tries the model's folder, then a Textures folder there and in each folder above it, up to Assets", () => {
    expect(textureCandidates(search())).toEqual([
      'Game/Assets/Art/Tree/bark.png',
      'Game/Assets/Art/Tree/Textures/bark.png',
      'Game/Assets/Art/Textures/bark.png',
      'Game/Assets/Textures/bark.png',
    ]);
  });

  it('then the path the model stores relative to itself, when it leads inside the project', () => {
    const candidates = textureCandidates(search({ storedPaths: ['..\\Materials\\bark.png', '../../../../../etc/bark.png', '..\\..\\..\\..\\Other\\bark.png'] }));
    expect(candidates.slice(4)).toEqual(['Game/Assets/Art/Materials/bark.png']);
  });

  it('then the absolute path the model stores, when it is inside the project on this machine', () => {
    const mac = search({ storedPaths: ['/Users/ana/wk/Game/Assets/Shared/bark.png', '/Users/bo/Art/bark.png', '/Users/ana/wk/Other/bark.png'] });
    expect(textureCandidates(mac).slice(4)).toEqual(['Game/Assets/Shared/bark.png']);
    const windows = search({ workspacePath: 'C:\\Users\\Ana\\wk', platform: 'win32', storedPaths: ['c:\\users\\ana\\WK\\Game\\Assets\\Shared\\bark.png', 'D:\\Art\\bark.png'] });
    expect(textureCandidates(windows).slice(4)).toEqual(['Game/Assets/Shared/bark.png']);
  });

  it('matches the absolute path as macOS does, its case and Unicode form aside, and takes its own spelling after the workspace', () => {
    const mac = search({ storedPaths: ['/Users/ana/WK/Game/Assets/Ñandú/bark.png'.normalize('NFD')] });
    expect(textureCandidates(mac).slice(4)).toEqual(['Game/Assets/Ñandú/bark.png'.normalize('NFD')]);
  });

  it("reads another OS's absolute path as nothing here, never as a relative one", () => {
    expect(textureCandidates(search({ storedPaths: ['C:\\Users\\Ana\\wk\\Game\\Assets\\bark.png'] })).slice(4)).toEqual([]);
    expect(textureCandidates(search({ platform: 'win32', workspacePath: 'C:\\wk', storedPaths: ['/Users/ana/wk/Game/Assets/bark.png'] })).slice(4)).toEqual([]);
  });

  it('matches the absolute path as Linux does: case counts', () => {
    const linux = search({ workspacePath: '/home/ana/wk', platform: 'linux', storedPaths: ['/home/ana/WK/Game/Assets/bark.png', '/home/ana/wk/Game/Assets/bark.png'] });
    expect(textureCandidates(linux).slice(4)).toEqual(['Game/Assets/bark.png']);
  });

  it('climbs to the workspace root outside a Unity project', () => {
    expect(textureCandidates(search({ modelPath: 'Art/Tree/Tree.obj' }))).toEqual(['Art/Tree/bark.png', 'Art/Tree/Textures/bark.png', 'Art/Textures/bark.png', 'Textures/bark.png']);
  });

  it('looks for nothing under a name that is a path', () => {
    expect(textureCandidates(search({ name: '../bark.png' }))).toEqual([]);
    expect(textureCandidates(search({ name: '' }))).toEqual([]);
  });

  it('lists each place once', () => {
    expect(textureCandidates(search({ storedPaths: ['bark.png', 'Textures/bark.png'] }))).toHaveLength(4);
  });
});

describe('preferredMatches', () => {
  it("prefers a file under the model's folder, then under each folder above it, then anywhere else by path", () => {
    const folders = searchedFolders({ modelPath: MODEL, project: unityProjectOf(MODEL) });
    expect(folders).toEqual(['Game/Assets/Art/Tree', 'Game/Assets/Art', 'Game/Assets']);
    const matches = ['Game/Assets/Z/bark.png', 'Game/Assets/Art/Rocks/bark.png', 'Game/Assets/Art/Tree/Maps/bark.png', 'Game/Assets/A/bark.png'];
    expect(preferredMatches(matches, folders)).toEqual(['Game/Assets/Art/Tree/Maps/bark.png', 'Game/Assets/Art/Rocks/bark.png', 'Game/Assets/A/bark.png', 'Game/Assets/Z/bark.png']);
  });
});
