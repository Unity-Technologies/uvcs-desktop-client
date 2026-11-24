// A fake of the site the official client updates from (docs/features/cm-runtime.md "Updating the installed one"), for
// the update screen's end-to-end test and for seeing its states in a development build with `UVCS_OFFICIAL_UPDATES_URL`
// pointing here and `UVCS_FAKE_OFFICIAL_UPDATE` faking the installer. It answers the latest-version question, redirects
// the installer page to the file as the real site does, and serves a small fake installer (macOS's zipped around a
// `.pkg`), resuming ranges. Nothing it serves is ever run: a development build's fake installer only waits.
//
//   node scripts/e2e/fakeOfficialSite.mjs [--latest=<version>|--latest=none] [--missing-installer] [--slow] [--port=<n>]
//
// prints the address to give `UVCS_OFFICIAL_UPDATES_URL`. `--slow` sends the installer over about a minute, to see the
// download's progress; `--missing-installer` answers 404 for it.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The installer's file name on the CDN, by the site's platform name, as the real site names them. */
function installerName(platform, version) {
  if (platform === 'windows') return `unity-vcs-${version}-win.exe`;
  return `unity-vcs-${version}-mac${platform === 'macos-arm64' ? '-arm' : ''}.pkg.zip`;
}

/** A fake macOS installer: a zip holding one `.pkg`, made with the system's bsdtar. */
function zippedPackage(version, bytes) {
  const folder = mkdtempSync(join(tmpdir(), 'uvcs-fake-pkg-'));
  try {
    writeFileSync(join(folder, `unity-vcs-osx-arm64-${version}.pkg`), bytes);
    execFileSync('tar', ['--format', 'zip', '-cf', 'installer.zip', `unity-vcs-osx-arm64-${version}.pkg`], { cwd: folder });
    return readFileSync(join(folder, 'installer.zip'));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/**
 * Starts the fake site. `latest` is the version it offers (null: nothing newer); `missingInstaller` answers 404 for the
 * installer; `slow` sends it in small pieces over about a minute.
 */
export async function startFakeOfficialSite({ latest, missingInstaller = false, slow = false, port = 0, size = 4 * 1024 * 1024 }) {
  const bytes = randomBytes(size);
  const files = new Map();
  const fileOf = (platform, version) => {
    const name = installerName(platform, version);
    if (!files.has(name)) files.set(name, platform === 'windows' ? bytes : zippedPackage(version, bytes));
    return { name, body: files.get(name) };
  };
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(`${request.method} ${request.url}`);
    const base = `http://127.0.0.1:${server.address().port}`;
    const lookup = /^\/api\/lastversion\/after\/[^/]+\/for\/([^/]+)\/([^/]+)$/.exec(request.url);
    if (lookup) {
      const [, , platform] = lookup;
      const answer = latest && {
        version: latest,
        releaseDate: '2026-11-19T00:00:00',
        versionsBehind: 3,
        downloadLink: `${base}/download/${latest}/${platform}`,
        installerUri: `${base}/download/downloadinstaller/${latest}/${platform}`,
      };
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(answer ?? null));
      return;
    }
    const page = /^\/download\/downloadinstaller\/([^/]+)\/([^/]+)$/.exec(request.url);
    if (page) {
      const [, version, platform] = page;
      response.writeHead(302, { location: `${base}/releases/${version}/${platform}/${installerName(platform, version)}` }).end();
      return;
    }
    const release = /^\/releases\/([^/]+)\/([^/]+)\/[^/]+$/.exec(request.url);
    if (!release || missingInstaller) {
      response.writeHead(404).end();
      return;
    }
    const { body } = fileOf(release[2], release[1]);
    const start = Number(/bytes=(\d+)-/.exec(request.headers.range ?? '')?.[1] ?? 0);
    const rest = body.subarray(start);
    response.writeHead(start > 0 ? 206 : 200, { 'content-length': rest.length, 'content-type': 'application/octet-stream' });
    if (request.method === 'HEAD') return response.end();
    if (!slow) return response.end(rest);
    const piece = Math.ceil(body.length / 600);
    let sent = 0;
    const timer = setInterval(() => {
      if (response.destroyed) return clearInterval(timer);
      response.write(rest.subarray(sent, sent + piece));
      sent += piece;
      if (sent >= rest.length) {
        clearInterval(timer);
        response.end();
      }
    }, 100);
  });
  await new Promise((listening) => server.listen(port, '127.0.0.1', listening));
  return { url: `http://127.0.0.1:${server.address().port}`, requests, close: () => server.close() };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const option = (name) => process.argv.find((argument) => argument.startsWith(`--${name}`))?.split('=')[1];
  const latest = option('latest') === 'none' ? null : (option('latest') ?? '11.0.16.99999');
  const site = await startFakeOfficialSite({ latest, missingInstaller: process.argv.includes('--missing-installer'), slow: process.argv.includes('--slow'), port: Number(option('port') ?? 0) });
  console.log(`UVCS_OFFICIAL_UPDATES_URL=${site.url}`);
}
