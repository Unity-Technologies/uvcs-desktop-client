import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { InstalledCm } from '@shared/domain/cmRuntime';
import type { OfficialUpdate } from '@shared/domain/officialUpdate';
import type { Fetch } from '../downloadBundle';
import { OfficialClientUpdate, type InstallerOutcome, type OfficialUpdateTools } from './OfficialClientUpdate';
import type { OfficialPlatform } from './officialRelease';
import type { SignatureVerdict } from './installerSignature';

const FLOOR = '11.0.16.10659';
const INSTALLED: InstalledCm = { path: 'C:\\Program Files\\PlasticSCM5\\client\\cm.exe', version: '11.0.16.9000' };
const SITE = 'https://www.plasticscm.com';
const LOOKUP = `${SITE}/api/lastversion/after/11.0.16.9000/for/cloud/windows`;
const INSTALLER_PAGE = `${SITE}/download/downloadinstaller/11.0.16.10694/plasticscm/windows/cloudedition`;
/** The name the installer downloads under (`installerFileName`). */
const FILE = 'unity-vcs-11.0.16.10694-cloud-windows.exe';
const INSTALLER_BYTES = new TextEncoder().encode('the official installer');

function answer(version: string): string {
  return JSON.stringify({ version, downloadLink: `${SITE}/download/${version}/plasticscm/windows/cloudedition`, installerUri: INSTALLER_PAGE, versionsBehind: 60 });
}

interface SiteOptions {
  lookup?: { status: number; body: string };
  installerStatus?: number;
}

/** The download site as it answers: the version as JSON, then the installer (its page's redirect followed by `fetch`). */
function fakeSite({ lookup = { status: 200, body: answer('11.0.16.10694') }, installerStatus = 200 }: SiteOptions = {}) {
  const requests: string[] = [];
  const fetch: Fetch = async (url, init) => {
    requests.push(`GET ${url}${init.headers.Range ? ` ${init.headers.Range}` : ''}`);
    if (url === LOOKUP) return new Response(lookup.body, { status: lookup.status });
    if (url === INSTALLER_PAGE) {
      if (installerStatus !== 200) return new Response(null, { status: installerStatus });
      const start = Number(/bytes=(\d+)-/.exec(init.headers.Range ?? '')?.[1] ?? 0);
      const body = INSTALLER_BYTES.subarray(start);
      return new Response(body, { status: start > 0 ? 206 : 200, headers: { 'content-length': String(body.length) } });
    }
    return new Response(null, { status: 404 });
  };
  return { fetch, requests };
}

interface Setup {
  site?: ReturnType<typeof fakeSite>;
  platform?: OfficialPlatform | null;
  verdict?: SignatureVerdict;
  outcome?: InstallerOutcome;
  /** The installed one's version once the installer ended. */
  versionAfter?: string;
}

async function setup({ site = fakeSite(), platform = 'windows', verdict = { trusted: true }, outcome = { kind: 'ended', exitCode: 0 }, versionAfter = '11.0.16.10694' }: Setup = {}) {
  const folder = join(await mkdtemp(join(tmpdir(), 'official-update-')), 'update');
  const calls: string[] = [];
  const states: (OfficialUpdate | null)[] = [];
  const tools: OfficialUpdateTools = {
    checkSignature: async (installer) => (calls.push(`check ${installer}`), verdict),
    run: async (installer) => (calls.push(`run ${installer.path} ${installer.version}`), outcome),
    unpack: async (archive, destination) => {
      calls.push(`unpack ${archive}`);
      await writeFile(join(destination, 'unity-vcs-osx-arm64-11.0.16.10694.pkg'), 'pkg');
    },
    linuxUpdateCommand: async (cmPath) => `sudo apt-get update && sudo apt-get install --only-upgrade plasticscm-cloud # ${cmPath}`,
  };
  const update: OfficialClientUpdate = new OfficialClientUpdate({
    platform,
    site: SITE,
    fetch: site.fetch,
    folder,
    editionOf: () => 'cloud',
    tools,
    holdCm: async () => {
      calls.push('hold cm');
      return () => calls.push('resume cm');
    },
    installedAgain: async () => (calls.push('read version'), { ...INSTALLED, version: versionAfter }),
    changed: () => states.push(update.state()),
    now: () => 0,
  });
  return { update, folder, calls, states, site, kinds: () => states.map((state) => state?.kind ?? null) };
}

describe('OfficialClientUpdate', () => {
  it('downloads the latest installer of the edition in the background, ready for the click', async () => {
    const { update, folder, site, kinds } = await setup();
    await update.prepare(INSTALLED, FLOOR);
    expect(site.requests).toEqual([`GET ${LOOKUP}`, `GET ${INSTALLER_PAGE}`]);
    expect(await readdir(folder)).toEqual([FILE]);
    expect(update.state()).toEqual({ kind: 'downloaded', version: '11.0.16.10694' });
    expect(kinds()).toEqual(['lookingUp', 'downloading', 'downloaded']);
  });

  it('installs on the click: checks the signature, holds cm, runs the installer and reads the version again, then resumes cm', async () => {
    const { update, folder, calls } = await setup();
    await update.prepare(INSTALLED, FLOOR);
    expect(await update.install(INSTALLED, FLOOR)).toBe(true);
    const installer = join(folder, FILE);
    expect(calls).toEqual([`check ${installer}`, 'hold cm', `run ${installer} 11.0.16.10694`, 'read version', 'resume cm']);
    expect(update.state()).toBeNull();
    expect(existsSync(folder)).toBe(false);
  });

  it('downloads first when the click comes before the background download, saying it is for the install', async () => {
    const { update, states } = await setup();
    expect(await update.install(INSTALLED, FLOOR)).toBe(true);
    expect(states.filter((state) => state?.kind === 'downloading').every((state) => state?.kind === 'downloading' && state.installRequested)).toBe(true);
    expect(states.map((state) => state?.kind ?? null)).toEqual(['lookingUp', 'downloading', 'downloaded', 'installing', null]);
  });

  it('joins the background download when the click comes while it runs, downloading once', async () => {
    const { update, site } = await setup();
    const background = update.prepare(INSTALLED, FLOOR);
    const installed = update.install(INSTALLED, FLOOR);
    await background;
    expect(await installed).toBe(true);
    expect(site.requests.filter((request) => request.startsWith(`GET ${INSTALLER_PAGE}`))).toHaveLength(1);
  });

  it('resumes a download cut short by an earlier launch', async () => {
    const { update, folder, site } = await setup();
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, `${FILE}.partial`), INSTALLER_BYTES.subarray(0, 5));
    await update.prepare(INSTALLED, FLOOR);
    expect(site.requests.at(-1)).toBe(`GET ${INSTALLER_PAGE} bytes=5-`);
  });

  it("deletes an older version's installer left behind", async () => {
    const { update, folder } = await setup();
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'unity-vcs-11.0.16.10600-cloud-windows.exe'), 'old');
    await update.prepare(INSTALLED, FLOOR);
    expect(await readdir(folder)).toEqual([FILE]);
  });

  it("runs the macOS package unpacked from the installer's zip", async () => {
    const site = fakeSite();
    const fetch: Fetch = (url, init) => site.fetch(url.includes('/for/cloud/macos-arm64') ? LOOKUP : url, init);
    const { update, folder, calls } = await setup({ site: { fetch, requests: [] }, platform: 'macos-arm64' });
    expect(await update.install({ path: '/Applications/PlasticSCM.app/Contents/MacOS/cm', version: '11.0.16.9000' }, FLOOR)).toBe(true);
    const zip = join(folder, 'unity-vcs-11.0.16.10694-cloud-macos-arm64.pkg.zip');
    expect(calls).toEqual([`unpack ${zip}`, `check ${join(`${zip}.unpacked`, 'unity-vcs-osx-arm64-11.0.16.10694.pkg')}`, 'hold cm', `run ${join(`${zip}.unpacked`, 'unity-vcs-osx-arm64-11.0.16.10694.pkg')} 11.0.16.10694`, 'read version', 'resume cm']);
  });

  describe('fails, saying why, once the user asked', () => {
    it('when the site has nothing newer', async () => {
      const { update, calls } = await setup({ site: fakeSite({ lookup: { status: 200, body: 'null' } }) });
      expect(await update.install(INSTALLED, FLOOR)).toBe(false);
      expect(update.state()).toEqual({ kind: 'failed', failure: 'noUpdate', version: null, detail: `${LOOKUP} has no newer version: null` });
      expect(calls).toEqual([]);
    });

    it('when the newest version the site has is still older than the app needs, never installing it', async () => {
      const { update, calls } = await setup({ site: fakeSite({ lookup: { status: 200, body: answer('11.0.16.10000') } }) });
      expect(await update.install(INSTALLED, FLOOR)).toBe(false);
      expect(update.state()).toMatchObject({ kind: 'failed', failure: 'noUpdate' });
      expect(calls).toEqual([]);
    });

    it('when the network fails, naming the address it tried', async () => {
      const offline: Fetch = async () => {
        throw new Error('net::ERR_INTERNET_DISCONNECTED');
      };
      const { update } = await setup({ site: { fetch: offline, requests: [] } });
      expect(await update.install(INSTALLED, FLOOR)).toBe(false);
      expect(update.state()).toEqual({ kind: 'failed', failure: 'unreachable', version: null, detail: `${LOOKUP}: net::ERR_INTERNET_DISCONNECTED` });
    });

    it("when the site can't be reached or has no installer", async () => {
      const lookupFailed = await setup({ site: fakeSite({ lookup: { status: 500, body: '{"error":"Invalid version number"}' } }) });
      expect(await lookupFailed.update.install(INSTALLED, FLOOR)).toBe(false);
      expect(lookupFailed.update.state()).toMatchObject({ kind: 'failed', failure: 'unreachable' });
      const noInstaller = await setup({ site: fakeSite({ installerStatus: 404 }) });
      expect(await noInstaller.update.install(INSTALLED, FLOOR)).toBe(false);
      expect(noInstaller.update.state()).toEqual({ kind: 'failed', failure: 'unreachable', version: null, detail: `HTTP 404 from ${INSTALLER_PAGE}` });
    });

    it("when the installer isn't signed by Unity: it never runs, and is deleted", async () => {
      const { update, folder, calls } = await setup({ verdict: { trusted: false, why: 'Its signature is HashMismatch' } });
      expect(await update.install(INSTALLED, FLOOR)).toBe(false);
      expect(update.state()).toMatchObject({ kind: 'failed', failure: 'notSigned', version: '11.0.16.10694' });
      expect(calls.some((call) => call.startsWith('run') || call === 'hold cm')).toBe(false);
      expect(existsSync(folder)).toBe(false);
    });

    it("when the user didn't give the installer permission, resuming cm", async () => {
      const { update, calls } = await setup({ outcome: { kind: 'declined' }, versionAfter: '11.0.16.9000' });
      expect(await update.install(INSTALLED, FLOOR)).toBe(false);
      expect(update.state()).toMatchObject({ kind: 'failed', failure: 'declined', version: '11.0.16.10694' });
      expect(calls.filter((call) => call.endsWith(' cm'))).toEqual(['hold cm', 'resume cm']);
    });

    it('when the installer ended and the installed one is still too old, keeping the download to try again', async () => {
      const { update, folder } = await setup({ outcome: { kind: 'ended', exitCode: 3 }, versionAfter: '11.0.16.9000' });
      expect(await update.install(INSTALLED, FLOOR)).toBe(false);
      expect(update.state()).toEqual({
        kind: 'failed',
        failure: 'notUpdated',
        version: '11.0.16.10694',
        detail: 'The installer of 11.0.16.10694 ended with exit code 3; the installed version is 11.0.16.9000.',
      });
      expect(await readdir(folder)).toEqual([FILE]);
    });
  });

  it('says nothing of a background download that failed: the click tries again', async () => {
    const { update, kinds } = await setup({ site: fakeSite({ lookup: { status: 200, body: 'null' } }) });
    await update.prepare(INSTALLED, FLOOR);
    expect(update.state()).toBeNull();
    expect(kinds()).toEqual(['lookingUp', null]);
  });

  it('on Linux, names the command that updates it, and installs nothing', async () => {
    const { update, site } = await setup({ platform: 'linux' });
    await update.prepare({ path: '/usr/bin/cm', version: '11.0.16.9000' }, FLOOR);
    expect(update.state()).toEqual({ kind: 'byCommand', command: 'sudo apt-get update && sudo apt-get install --only-upgrade plasticscm-cloud # /usr/bin/cm' });
    expect(await update.install(INSTALLED, FLOOR)).toBe(false);
    expect(site.requests).toEqual([]);
  });

  describe('dropped once nothing needs it', () => {
    it('stops a background download and deletes what it downloaded', async () => {
      const site = fakeSite();
      let installerAsked = (): void => undefined;
      const asked = new Promise<void>((resolve) => (installerAsked = resolve));
      // The installer never arrives: only the drop ends its download.
      const fetch: Fetch = (url, init) => {
        if (url !== INSTALLER_PAGE) return site.fetch(url, init);
        installerAsked();
        return new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(init.signal?.reason)));
      };
      const { update, folder } = await setup({ site: { fetch, requests: [] } });
      const background = update.prepare(INSTALLED, FLOOR);
      await asked;

      await update.discard();
      await background;
      expect(update.state()).toBeNull();
      expect(existsSync(folder)).toBe(false);
    });

    it('deletes an installer an earlier launch left behind', async () => {
      const { update, folder } = await setup();
      await mkdir(folder, { recursive: true });
      await writeFile(join(folder, FILE), 'old');
      await update.discard();
      expect(existsSync(folder)).toBe(false);
    });

    it('keeps an installer an app update downloaded for Restart & Install', async () => {
      const { update, folder } = await setup();
      await update.downloadAhead(INSTALLED, FLOOR, () => undefined);
      await update.discard();
      expect(await readdir(folder)).toEqual([FILE]);
      expect(update.state()).toEqual({ kind: 'downloaded', version: '11.0.16.10694' });
    });
  });

  describe('along with an app update that needs a newer one', () => {
    const NEXT_FLOOR = '11.0.16.10690';

    it('downloads the installer, telling how far, and installs it at the update’s floor', async () => {
      const { update, folder, calls } = await setup();
      const fractions: number[] = [];
      await update.downloadAhead(INSTALLED, NEXT_FLOOR, (fraction) => fractions.push(fraction));
      expect(fractions.at(0)).toBe(0);
      expect(fractions.at(-1)).toBe(1);
      expect(await update.install(INSTALLED, NEXT_FLOOR)).toBe(true);
      expect(calls).toContain(`run ${join(folder, FILE)} 11.0.16.10694`);
    });

    it('fails, showing nothing, when no version as new as the update needs is published', async () => {
      const { update } = await setup();
      await expect(update.downloadAhead(INSTALLED, '11.0.16.10800', () => undefined)).rejects.toMatchObject({ failure: 'noUpdate' });
      expect(update.state()).toBeNull();
    });

    it('passes over an installer downloaded for an older floor', async () => {
      const { update, site } = await setup({ site: fakeSite({ lookup: { status: 200, body: answer('11.0.16.10694') } }) });
      await update.prepare(INSTALLED, FLOOR);
      await expect(update.downloadAhead(INSTALLED, '11.0.16.10700', () => undefined)).rejects.toMatchObject({ failure: 'noUpdate' });
      expect(site.requests.filter((request) => request === `GET ${LOOKUP}`)).toHaveLength(2);
    });

    it('says how the installed one updates: its installer, a command on Linux, or not at all', async () => {
      expect((await setup()).update.updatesBy()).toBe('installer');
      expect((await setup({ platform: 'linux' })).update.updatesBy()).toBe('command');
      expect((await setup({ platform: null })).update.updatesBy()).toBeNull();
    });
  });
});
