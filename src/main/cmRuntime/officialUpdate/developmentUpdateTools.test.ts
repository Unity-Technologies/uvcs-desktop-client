import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { developmentUpdateOf, developmentUpdateTools } from './developmentUpdateTools';
import type { OfficialUpdateTools } from './OfficialClientUpdate';

const REAL: OfficialUpdateTools = {
  checkSignature: async () => ({ trusted: true }),
  run: async () => ({ kind: 'ended', exitCode: 0 }),
  unpack: async () => undefined,
  linuxUpdateCommand: async () => 'sudo apt-get update && sudo apt-get install --only-upgrade plasticscm-client-core',
};

describe('developmentUpdateOf', () => {
  it('reads the outcome a development build fakes', () => {
    expect(developmentUpdateOf({ UVCS_FAKE_OFFICIAL_UPDATE: 'declined' }, false)).toBe('declined');
    expect(developmentUpdateOf({}, false)).toBeNull();
    expect(developmentUpdateOf({ UVCS_FAKE_OFFICIAL_UPDATE: 'anything' }, false)).toBeNull();
  });

  it('is never read by a packaged app: no variable skips the signature check there', () => {
    expect(developmentUpdateOf({ UVCS_FAKE_OFFICIAL_UPDATE: 'installs' }, true)).toBeNull();
  });
});

describe('developmentUpdateTools', () => {
  const installer = { path: '/tmp/update/unity-vcs-11.0.16.10694-mac-arm.pkg', version: '11.0.16.10694' };
  const instantly = async () => undefined;

  it('installs by writing the new version where the fake cm reads it, running nothing', async () => {
    const versionFile = join(await mkdtemp(join(tmpdir(), 'fake-update-')), 'cm-version');
    const tools = developmentUpdateTools('installs', REAL, { versionFile, wait: instantly });
    expect(await tools.checkSignature(installer.path)).toEqual({ trusted: true });
    expect(await tools.run(installer)).toEqual({ kind: 'ended', exitCode: 0 });
    expect(await readFile(versionFile, 'utf8')).toBe('11.0.16.10694');
  });

  it('fails, is declined or finds the installer unsigned, as asked', async () => {
    expect(await developmentUpdateTools('fails', REAL, { versionFile: undefined, wait: instantly }).run(installer)).toEqual({ kind: 'ended', exitCode: 1 });
    expect(await developmentUpdateTools('declined', REAL, { versionFile: undefined, wait: instantly }).run(installer)).toEqual({ kind: 'declined' });
    expect(await developmentUpdateTools('unsigned', REAL, { versionFile: undefined, wait: instantly }).checkSignature(installer.path)).toEqual({ trusted: false, why: 'Its signature is NotSigned' });
  });
});
