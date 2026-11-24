import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, win32 } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cmInstallFailureOf } from './cmInstallFailure';
import { zipOf } from './testing/zipOf';
import { tarPath } from './tarPath';
import { unpackBundle, unpackFailure } from './unpackBundle';

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

  it('unpacks into a folder whose path has accents and spaces, given to tar relative to the archive', async () => {
    const folder = join(await mkdtemp(join(tmpdir(), 'cm-unpack-')), 'José Pérez');
    await mkdir(join(folder, 'source', 'client'), { recursive: true });
    await writeFile(join(folder, 'source', 'client', 'cm'), 'a cm');
    const archive = join(folder, '11.0.16.10659.partial');
    expect(spawnSync(tarPath(process.platform, process.env), ['-czf', archive, '-C', join(folder, 'source'), 'client']).status).toBe(0);
    await mkdir(join(folder, '11.0.16.10659.unpacking'));
    await unpackBundle(archive, join(folder, '11.0.16.10659.unpacking'), process.platform, process.env);
    expect(await readFile(join(folder, '11.0.16.10659.unpacking', 'client', 'cm'), 'utf8')).toBe('a cm');
  });

  // The Windows bundle is a zip, which only Windows unpacks: bsdtar (Windows' System32 one, macOS's) reads it, Linux's
  // GNU tar doesn't, and never has to.
  it.skipIf(process.platform === 'linux')('unpacks a zip, as the Windows bundle is', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'cm-unpack-'));
    const archive = join(folder, '11.0.16.10659.partial');
    await writeFile(archive, zipOf({ 'client/cm.exe': 'a cm' }));
    await mkdir(join(folder, '11.0.16.10659.unpacking'));
    await unpackBundle(archive, join(folder, '11.0.16.10659.unpacking'), process.platform, process.env);
    expect(await readFile(join(folder, '11.0.16.10659.unpacking', 'client', 'cm.exe'), 'utf8')).toBe('a cm');
  });

  it('fails as blocked, never as damaged, when tar stops on an archive already checked as published', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'cm-unpack-'));
    await writeFile(join(folder, 'bundle.tar.gz'), 'not an archive');
    const unpacking = unpackBundle(join(folder, 'bundle.tar.gz'), folder, process.platform, process.env);
    await expect(unpacking.catch(cmInstallFailureOf)).resolves.toBe('blocked');
  });
});

describe('unpackFailure', () => {
  it('reads a full disk and a folder that can’t be written from tar’s errors', () => {
    expect(unpackFailure('tar: client/cm: Write failed: No space left on device')).toBe('diskFull');
    expect(unpackFailure('tar: client/cm.exe: Can\'t create \'client\\cm.exe\': Access is denied.')).toBe('notWritable');
    expect(unpackFailure('tar: client: Cannot mkdir: Permission denied')).toBe('notWritable');
    expect(unpackFailure('tar: Error opening archive: Unrecognized archive format')).toBe('blocked');
  });
});
