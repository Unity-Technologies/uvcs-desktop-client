import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAIN_BRANCH_GUID } from '@shared/domain/branch';
import { loadRecentBranches, saveRecentBranch } from './recentBranches';

const WORKSPACE = 'a0411612-d36e-4eca-b9b5-97acad5969ea';
const branch = (n: number): string => `9b8e2f7a-58f3-4c43-9d83-3c2f1f5c000${n}`;

let configFolder: string;

beforeEach(() => {
  // The official client's settings folder, where `plasticgui.conf` is shared with it.
  configFolder = join(mkdtempSync(join(tmpdir(), 'uvcs-plastic4-')), 'plastic4');
  vi.stubEnv('PLASTIC_HOME', configFolder);
});

afterEach(() => vi.unstubAllEnvs());

describe('recent branches shared with the official client', () => {
  it('reads none before the official client or the app wrote any', async () => {
    expect(await loadRecentBranches(WORKSPACE)).toEqual([]);
  });

  it('keeps each switch, newest first, creating the file where the official client reads it', async () => {
    await saveRecentBranch(WORKSPACE, branch(1));
    await saveRecentBranch(WORKSPACE, branch(2));

    expect(await loadRecentBranches(WORKSPACE)).toEqual([branch(2), branch(1)]);
    expect(readFileSync(join(configFolder, 'plasticgui.conf'), 'utf8')).toContain(`[${WORKSPACE}]`);
  });

  it('loses no switch when windows save at the same time: saves go one at a time', async () => {
    await Promise.all([1, 2, 3].map((n) => saveRecentBranch(WORKSPACE, branch(n))));

    expect(await loadRecentBranches(WORKSPACE)).toEqual([branch(3), branch(2), branch(1)]);
  });

  it('never keeps /main, as the official client does', async () => {
    await saveRecentBranch(WORKSPACE, MAIN_BRANCH_GUID.toUpperCase());
    expect(await loadRecentBranches(WORKSPACE)).toEqual([]);
  });

  it("leaves the official client's other settings as they were", async () => {
    await saveRecentBranch(WORKSPACE, branch(1));
    const conf = join(configFolder, 'plasticgui.conf');
    writeFileSync(conf, `[general]\r\ntheme=dark\r\n${readFileSync(conf, 'utf8').replaceAll('\n', '\r\n')}`);

    await saveRecentBranch(WORKSPACE, branch(2));
    expect(readFileSync(conf, 'utf8').startsWith('[general]\r\ntheme=dark\r\n')).toBe(true);
    expect(await loadRecentBranches(WORKSPACE)).toEqual([branch(2), branch(1)]);
  });
});
