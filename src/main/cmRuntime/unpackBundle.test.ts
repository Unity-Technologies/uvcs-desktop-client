import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, win32 } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cmInstallFailureOf } from './cmInstallFailure';
import { tarPath, unpackBundle } from './unpackBundle';

describe('tarPath', () => {
  it('is System32’s tar on Windows, which reads zip, never the first one on the PATH', () => {
    expect(tarPath('win32', { SystemRoot: 'D:\\Windows' })).toBe(win32.join('D:\\Windows', 'System32', 'tar.exe'));
    expect(tarPath('win32', {})).toBe(win32.join('C:\\Windows', 'System32', 'tar.exe'));
  });

  it('is the system’s tar on macOS and Linux', () => {
    expect(tarPath('darwin', {})).toBe('tar');
    expect(tarPath('linux', {})).toBe('tar');
  });
});

describe('unpackBundle', () => {
  it('unpacks a gzipped tar into the folder, as the bundles are laid out', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'cm-unpack-'));
    await mkdir(join(folder, 'source', 'client'), { recursive: true });
    await writeFile(join(folder, 'source', 'client', 'cm'), 'a cm');
    const archive = join(folder, 'bundle.tar.gz');
    const tar = tarPath(process.platform, process.env);
    expect(spawnSync(tar, ['-czf', archive, '-C', join(folder, 'source'), 'client']).status).toBe(0);
    await mkdir(join(folder, 'unpacked'));
    await unpackBundle(archive, join(folder, 'unpacked'), process.platform, process.env);
    expect(await readFile(join(folder, 'unpacked', 'client', 'cm'), 'utf8')).toBe('a cm');
  });

  it('fails as damaged on a file that isn’t an archive', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'cm-unpack-'));
    await writeFile(join(folder, 'bundle.tar.gz'), 'not an archive');
    const unpacking = unpackBundle(join(folder, 'bundle.tar.gz'), folder, process.platform, process.env);
    await expect(unpacking.catch(cmInstallFailureOf)).resolves.toBe('damaged');
  });
});
