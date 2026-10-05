/**
 * Checks, on Windows, that every .exe of a release passes the check the app's updater makes before installing it
 * (electron-updater's `verifySignature`, windowsExecutableCodeSignatureVerifier): a valid Authenticode signature whose
 * signer is the publisher electron-builder.windows-signed.yml names. The signing repo's Sign workflow runs it on the
 * installers, on what they install and on what they carry for the other architecture, and fails the release on any
 * file that wouldn't pass.
 *
 *   node scripts/build/verifyWindowsSignatures.ts <file or folder>...
 *
 * Only Node's own modules: it runs on a runner that hasn't installed the repository's packages.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** One file's signature as `Get-AuthenticodeSignature` reports it (`signaturesCommand` selects these fields). */
export interface FileSignature {
  Path: string;
  /** `SignatureStatus`: 0 is Valid. */
  Status: number;
  /** The signer certificate's subject (a distinguished name), or null when the file isn't signed. */
  Subject: string | null;
}

/** Get-AuthenticodeSignature's `Status` for a valid signature (`SignatureStatus.Valid`). */
const VALID_SIGNATURE = 0;

/** The publisher names electron-builder writes into the app's app-update.yml (`win.signtoolOptions.publisherName`). */
export function publisherNamesOf(signedConfig: string): string[] {
  const names = signedConfig.match(/^\s+publisherName:\s*(.+)$/m)?.[1]?.trim();
  if (!names) return [];
  return names.startsWith('[') ? names.slice(1, -1).split(',').map((name) => name.trim()) : [names];
}

/**
 * The fields of a distinguished name, read exactly as electron-updater reads the signer: a line-for-line port of
 * builder-util-runtime's `parseDn` (rfc2253Parser.js, MIT; verifyWindowsSignatures.test.ts holds them equal), since this
 * script can't import packages. Quirks included: a quote toggles quoting and is dropped, `\XX` is a hex character.
 */
export function distinguishedName(text: string): Map<string, string> {
  const seq = text.trim();
  const result = new Map<string, string>();
  let quoted = false;
  let key: string | null = null;
  let token = '';
  let nextNonSpace = 0;
  for (let i = 0; i <= seq.length; i++) {
    if (i === seq.length) {
      if (key !== null) result.set(key, token);
      break;
    }
    const ch = seq[i]!;
    if (quoted) {
      if (ch === '"') {
        quoted = false;
        continue;
      }
    } else {
      if (ch === '"') {
        quoted = true;
        continue;
      }
      if (ch === '\\') {
        i++;
        const ord = parseInt(seq.slice(i, i + 2), 16);
        if (Number.isNaN(ord)) {
          token += seq[i];
        } else {
          i++;
          token += String.fromCharCode(ord);
        }
        continue;
      }
      if (key === null && ch === '=') {
        key = token;
        token = '';
        continue;
      }
      if (ch === ',' || ch === ';' || ch === '+') {
        if (key !== null) result.set(key, token);
        key = null;
        token = '';
        continue;
      }
    }
    if (ch === ' ' && !quoted) {
      if (token.length === 0) continue;
      if (i > nextNonSpace) {
        let j = i;
        while (seq[j] === ' ') j++;
        nextNonSpace = j;
      }
      const next = seq[nextNonSpace];
      if (nextNonSpace >= seq.length || next === ',' || next === ';' || (key === null && next === '=') || (key !== null && next === '+')) {
        i = nextNonSpace - 1;
        continue;
      }
    }
    token += ch;
  }
  return result;
}

/**
 * Why a file would fail the updater's check, or null when it passes: the signature must be valid, and a publisher name
 * must equal the signer's common name (CN) or, written as a full DN, match every field it names.
 */
export function signatureProblem(signature: FileSignature, publisherNames: string[]): string | null {
  const { Path, Status, Subject } = signature;
  if (Status !== VALID_SIGNATURE || !Subject) return `${Path} has no valid signature (status ${Status}).`;

  const signer = distinguishedName(Subject);
  const matches = publisherNames.some((name) => {
    const dn = distinguishedName(name);
    return dn.size > 0 ? [...dn.keys()].every((key) => dn.get(key) === signer.get(key)) : name === signer.get('CN');
  });
  return matches ? null : `${Path} is signed by "${Subject}", not by the publisher updates expect (${publisherNames.join(' | ')}).`;
}

/** The signatures `signaturesCommand` printed: PowerShell prints a lone object, not an array, for one file. */
export function parseSignatures(json: string): FileSignature[] {
  const parsed = JSON.parse(json) as FileSignature | FileSignature[];
  return Array.isArray(parsed) ? parsed : [parsed];
}

/** Every .exe under the given files and folders, sorted. */
export function executablesIn(paths: string[]): string[] {
  return paths
    .flatMap((path) => (statSync(path).isDirectory() ? executablesIn(readdirSync(path).map((name) => join(path, name))) : [path]))
    .filter((path) => path.toLowerCase().endsWith('.exe'))
    .sort();
}

/** The PowerShell that reports each file's signature as JSON. The paths come through the environment, unquoted. */
const signaturesCommand = [
  '$files = $env:SIGNED_FILES | ConvertFrom-Json',
  '$files | ForEach-Object { Get-AuthenticodeSignature -LiteralPath $_ } |',
  '  Select-Object @{ n = "Path"; e = { $_.Path } }, @{ n = "Status"; e = { [int]$_.Status } },',
  '    @{ n = "Subject"; e = { $_.SignerCertificate.Subject } } |',
  '  ConvertTo-Json -Compress',
].join('\n');

/**
 * Windows PowerShell's environment: the files to check, and no PSModulePath. Started from PowerShell 7 (a pwsh step),
 * it inherits PowerShell 7's module path and can't load Get-AuthenticodeSignature; electron-updater clears it for the
 * same reason (`set "PSModulePath="`, windowsExecutableCodeSignatureVerifier).
 */
export function powershellEnvironment(env: NodeJS.ProcessEnv, files: string[]): NodeJS.ProcessEnv {
  const withoutModulePath = Object.fromEntries(Object.entries(env).filter(([name]) => name.toUpperCase() !== 'PSMODULEPATH'));
  return { ...withoutModulePath, SIGNED_FILES: JSON.stringify(files) };
}

function signaturesOf(files: string[]): FileSignature[] {
  const json = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', signaturesCommand], {
    env: powershellEnvironment(process.env, files),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  return parseSignatures(json);
}

function main(paths: string[]): void {
  const root = resolve(import.meta.dirname, '..', '..');
  const publisherNames = publisherNamesOf(readFileSync(join(root, 'electron-builder.windows-signed.yml'), 'utf8'));
  const files = executablesIn(paths);
  if (publisherNames.length === 0) throw new Error('electron-builder.windows-signed.yml names no publisher.');
  if (files.length === 0) throw new Error(`No .exe under ${paths.join(', ')}.`);

  const signatures = signaturesOf(files);
  for (const signature of signatures) console.log(`${signatureProblem(signature, publisherNames) ? '✗' : '✓'} ${signature.Path}`);
  const problems = signatures.map((signature) => signatureProblem(signature, publisherNames)).filter((problem) => problem !== null);
  if (problems.length > 0 || signatures.length !== files.length) {
    throw new Error([`${problems.length} of ${files.length} files fail the updater's check:`, ...problems].join('\n'));
  }
  console.log(`All ${files.length} files are signed by ${publisherNames.join(' | ')}.`);
}

if (import.meta.filename === resolve(process.argv[1] ?? '')) main(process.argv.slice(2));
