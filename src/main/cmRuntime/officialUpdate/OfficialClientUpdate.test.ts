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
const CDN = 'https://d26z97tczqnlef.cloudfront.net/releases/11.0.16.10694/plasticscm/windows/unity-vcs-11.0.16.10694-win.exe';
const INSTALLER_BYTES = new TextEncoder().encode('the official installer');

function answer(version: string): string {
  return JSON.stringify({ version, downloadLink: `${SITE}/download/${version}/plasticscm/windows/cloudedition`, installerUri: INSTALLER_PAGE, versionsBehind: 60 });
}

interface SiteOptions {
  lookup?: { status: number; body: string };
  installerStatus?: number;
}

/** The download site as it answers: the version as JSON, the installer page redirecting to the file on the CDN. */
function fakeSite({ lookup = { status: 200, body: answer('11.0.16.10694') }, installerStatus = 200 }: SiteOptions = {}) {
  const requests: string[] = [];
  const fetch: Fetch = async (url, init) => {
    requests.push(`${init.method ?? 'GET'} ${url}${init.headers.Range ? ` ${init.headers.Range}` : ''}`);
    if (url === LOOKUP) return new Response(lookup.body, { status: lookup.status });
    if (url === INSTALLER_PAGE) return Object.defineProperty(new Response(null, { status: installerStatus }), 'url', { value: CDN });
    if (url === CDN) {
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
    stopCm: () => calls.push('stop cm'),
    installedAgain: async () => ({ ...INSTALLED, version: versionAfter }),
    changed: () => states.push(update.state()),
    now: () => 0,
  });
  return { update, folder, calls, states, site, kinds: () => states.map((state) => state?.kind ?? null) };
}

describe('OfficialClientUpdate', () => {
  it('downloads the latest installer of the edition in the background, ready for the click', async () => {
    const { update, folder, site, kinds } = await setup();
    await update.prepare(INSTALLED, FLOOR);
    expect(site.requests).toEqual([`GET ${LOOKUP}`, `HEAD ${INSTALLER_PAGE}`, `GET ${CDN}`]);
    expect(await readdir(folder)).toEqual(['unity-vcs-11.0.16.10694-win.exe']);
    expect(update.state()).toEqual({ kind: 'downloaded', version: '11.0.16.10694' });
    expect(kinds()).toEqual(['lookingUp', 'downloading', 'downloaded']);
  });

  it('installs on the click: checks the signature, stops cm, runs the installer and reads the version again', async () => {
    const { update, folder, calls } = await setup();
    await update.prepare(INSTALLED, FLOOR);
    expect(await update.install(INSTALLED, FLOOR)).toBe(true);
    const installer = join(folder, 'unity-vcs-11.0.16.10694-win.exe');
    expect(calls).toEqual([`check ${installer}`, 'stop cm', `run ${installer} 11.0.16.10694`]);
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
    expect(site.requests.filter((request) => request.startsWith(`GET ${CDN}`))).toHaveLength(1);
  });

  it('resumes a download cut short by an earlier launch', async () => {
    const { update, folder, site } = await setup();
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'unity-vcs-11.0.16.10694-win.exe.partial'), INSTALLER_BYTES.subarray(0, 5));
    await update.prepare(INSTALLED, FLOOR);
    expect(site.requests.at(-1)).toBe(`GET ${CDN} bytes=5-`);
  });

  it("deletes an older version's installer left behind", async () => {
    const { update, folder } = await setup();
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'unity-vcs-11.0.16.10600-win.exe'), 'old');
    await update.prepare(INSTALLED, FLOOR);
    expect(await readdir(folder)).toEqual(['unity-vcs-11.0.16.10694-win.exe']);
  });

  it("runs the macOS package unpacked from the installer's zip", async () => {
    const zipUrl = 'https://d26z97tczqnlef.cloudfront.net/releases/11.0.16.10694/plasticscm/osx/unity-vcs-11.0.16.10694-mac-arm.pkg.zip';
    const site = fakeSite();
    const fetch: Fetch = async (url, init) => {
      if (url.includes('/for/cloud/macos-arm64')) return site.fetch(LOOKUP, init);
      if (url === INSTALLER_PAGE) return Object.defineProperty(new Response(null), 'url', { value: zipUrl });
      if (url === zipUrl) return new Response(INSTALLER_BYTES, { headers: { 'content-length': String(INSTALLER_BYTES.length) } });
      return new Response(null, { status: 404 });
    };
    const { update, folder, calls } = await setup({ site: { fetch, requests: [] }, platform: 'macos-arm64' });
    expect(await update.install({ path: '/Applications/PlasticSCM.app/Contents/MacOS/cm', version: '11.0.16.9000' }, FLOOR)).toBe(true);
    const zip = join(folder, 'unity-vcs-11.0.16.10694-mac-arm.pkg.zip');
    expect(calls).toEqual([`unpack ${zip}`, `check ${join(`${zip}.unpacked`, 'unity-vcs-osx-arm64-11.0.16.10694.pkg')}`, 'stop cm', `run ${join(`${zip}.unpacked`, 'unity-vcs-osx-arm64-11.0.16.10694.pkg')} 11.0.16.10694`]);
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
      expect(calls.some((call) => call.startsWith('run') || call === 'stop cm')).toBe(false);
      expect(existsSync(folder)).toBe(false);
    });

    it("when the user didn't give the installer permission", async () => {
      const { update } = await setup({ outcome: { kind: 'declined' }, versionAfter: '11.0.16.9000' });
      expect(await update.install(INSTALLED, FLOOR)).toBe(false);
      expect(update.state()).toMatchObject({ kind: 'failed', failure: 'declined', version: '11.0.16.10694' });
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
      expect(await readdir(folder)).toEqual(['unity-vcs-11.0.16.10694-win.exe']);
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
});
