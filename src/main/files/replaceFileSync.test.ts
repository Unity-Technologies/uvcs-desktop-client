import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { replaceFileSync, type ReplaceFileSystem } from './replaceFileSync';

const busy = (code: string): Error => Object.assign(new Error(`${code}: operation not permitted, rename`), { code });

/** A file system whose rename fails with `failures` first, one per try, and that records what was asked of it. */
function fakeFileSystem(failures: Error[] = []) {
  const asked: string[] = [];
  const fs: ReplaceFileSystem = {
    writeFileSync: (path) => void asked.push(`write ${path}`),
    renameSync: (from, to) => {
      asked.push(`rename ${from} ${to}`);
      const failure = failures.shift();
      if (failure) throw failure;
    },
    rmSync: (path) => void asked.push(`remove ${path}`),
  };
  return { fs, asked };
}

describe('replaceFileSync', () => {
  it('writes a temp file next to the file, then renames it over the file: a crash leaves the old or the new one whole', () => {
    const filePath = join(mkdtempSync(join(tmpdir(), 'replace-')), 'settings.json');
    writeFileSync(filePath, '{"theme":"light"}');

    replaceFileSync(filePath, '{"theme":"dark"}');

    expect(readFileSync(filePath, 'utf8')).toBe('{"theme":"dark"}');
    expect(readdirSync(dirname(filePath))).toEqual(['settings.json']);
  });

  it('tries the rename again on Windows while another program holds the file, for a moment', () => {
    const { fs, asked } = fakeFileSystem([busy('EPERM'), busy('EBUSY')]);
    const slept: number[] = [];

    replaceFileSync('C:\\data\\settings.json', '{}', { fs, platform: 'win32', sleep: (ms) => void slept.push(ms) });

    expect(asked.filter((step) => step.startsWith('rename'))).toHaveLength(3);
    expect(slept).toHaveLength(2);
  });

  it('gives up after a few tries, removing its temp file, and fails at once elsewhere or on other errors', () => {
    const stuck = fakeFileSystem(Array.from({ length: 20 }, () => busy('EACCES')));
    expect(() => replaceFileSync('C:\\data\\settings.json', '{}', { fs: stuck.fs, platform: 'win32', sleep: () => {} })).toThrow('EACCES');
    expect(stuck.asked.at(-1)).toMatch(/^remove /);
    expect(stuck.asked.filter((step) => step.startsWith('rename')).length).toBeLessThan(10);

    const onLinux = fakeFileSystem([busy('EPERM')]);
    expect(() => replaceFileSync('/data/settings.json', '{}', { fs: onLinux.fs, platform: 'linux', sleep: () => {} })).toThrow('EPERM');
    expect(onLinux.asked.filter((step) => step.startsWith('rename'))).toHaveLength(1);

    const full = fakeFileSystem([busy('ENOSPC')]);
    expect(() => replaceFileSync('C:\\data\\settings.json', '{}', { fs: full.fs, platform: 'win32', sleep: () => {} })).toThrow('ENOSPC');
    expect(full.asked.filter((step) => step.startsWith('rename'))).toHaveLength(1);
  });
});
