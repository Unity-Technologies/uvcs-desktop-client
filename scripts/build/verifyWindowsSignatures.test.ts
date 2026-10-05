import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDn } from 'builder-util-runtime';
import { describe, expect, it } from 'vitest';
import {
  distinguishedName,
  executablesIn,
  parseSignatures,
  powershellEnvironment,
  publisherNamesOf,
  signatureProblem,
  type FileSignature,
} from './verifyWindowsSignatures';

const ROOT = join(__dirname, '..', '..');

const SUBJECT =
  'CN=Unity Technologies SF, O=Unity Technologies SF, L=San Francisco, S=California, C=US, SERIALNUMBER=3183233, OID.2.5.4.15=Private Organization';
const FILE = 'C:\\Users\\runner\\AppData\\Local\\Programs\\Unity Version Control\\Unity Version Control.exe';

function signature(status: number, subject: string | null): FileSignature {
  return { Path: FILE, Status: status, Subject: subject };
}

describe('the publisher the updater expects', () => {
  it('is the one electron-builder.windows-signed.yml names', () => {
    const config = readFileSync(join(ROOT, 'electron-builder.windows-signed.yml'), 'utf8');
    expect(publisherNamesOf(config)).toEqual(['Unity Technologies SF']);
  });

  it('reads a list of names too', () => {
    expect(publisherNamesOf('win:\n  signtoolOptions:\n    publisherName: [Unity Technologies SF, Codice Software]\n')).toEqual([
      'Unity Technologies SF',
      'Codice Software',
    ]);
  });

  it('is none when the config names none', () => {
    expect(publisherNamesOf('extends: ./electron-builder.yml\n')).toEqual([]);
  });
});

describe('a distinguished name', () => {
  // The updater reads the signer with builder-util-runtime's parseDn; this copy (the script can't import packages)
  // must read every name the same way.
  it.each([
    SUBJECT,
    'CN=Unity Technologies SF, O="Unity Technologies, Inc.", C=US',
    'CN="Quoted ""inner"" name", C=DK',
    'CN=Unity Technologies SF',
    'CN = Spaced , O = Out',
    'CN=Escaped\\2C Comma, O=A;OU=B+C=D',
    'Unity Technologies SF',
  ])('reads %s as the updater does', (name) => {
    expect(distinguishedName(name)).toEqual(parseDn(name));
  });
});

describe("a file's check against the publisher updates expect", () => {
  it('passes a valid signature whose common name is the publisher', () => {
    expect(signatureProblem(signature(0, SUBJECT), ['Unity Technologies SF'])).toBeNull();
  });

  it('passes when one of several names matches', () => {
    expect(signatureProblem(signature(0, SUBJECT), ['Codice Software', 'Unity Technologies SF'])).toBeNull();
  });

  it('passes a full distinguished name only when every field it names matches', () => {
    expect(signatureProblem(signature(0, SUBJECT), ['CN=Unity Technologies SF, C=US'])).toBeNull();
    expect(signatureProblem(signature(0, SUBJECT), ['CN=Unity Technologies SF, C=DK'])).toMatch(/not by the publisher/);
  });

  it('fails a file signed by another name, saying who signed it', () => {
    const problem = signatureProblem(signature(0, SUBJECT), ['Unity Technologies ApS']);
    expect(problem).toContain(`signed by "${SUBJECT}"`);
    expect(problem).toContain('(Unity Technologies ApS)');
  });

  it('fails a signature that is not valid (a file changed after it was signed)', () => {
    expect(signatureProblem(signature(1, SUBJECT), ['Unity Technologies SF'])).toBe(`${FILE} has no valid signature (status 1).`);
  });

  it('fails a file with no signature', () => {
    expect(signatureProblem(signature(2, null), ['Unity Technologies SF'])).toMatch(/no valid signature \(status 2\)/);
  });
});

describe("PowerShell's report", () => {
  it('reads several files', () => {
    const json = JSON.stringify([signature(0, SUBJECT), { Path: 'C:\\b.exe', Status: 2, Subject: null }]);
    expect(parseSignatures(json)).toEqual([signature(0, SUBJECT), { Path: 'C:\\b.exe', Status: 2, Subject: null }]);
  });

  it('reads one file, which PowerShell prints as a lone object', () => {
    expect(parseSignatures(JSON.stringify(signature(0, SUBJECT)))).toEqual([signature(0, SUBJECT)]);
  });
});

describe('the files checked', () => {
  it('are every .exe under the folders and files given, in any case, sorted', () => {
    const root = mkdtempSync(join(tmpdir(), 'executables-'));
    const app = join(root, 'win-unpacked');
    mkdirSync(join(app, 'resources'), { recursive: true });
    for (const file of [join(app, 'Unity Version Control.exe'), join(app, 'resources', 'elevate.EXE'), join(app, 'ffmpeg.dll')]) {
      writeFileSync(file, '');
    }
    const installer = join(root, 'UnityVersionControl-1.2.3-Windows-x64.exe');
    writeFileSync(installer, '');

    expect(executablesIn([app, installer])).toEqual(
      [join(app, 'Unity Version Control.exe'), join(app, 'resources', 'elevate.EXE'), installer].sort(),
    );
  });
});

describe("Windows PowerShell's environment", () => {
  it("drops PowerShell 7's module path, in any case, and passes the files", () => {
    const env = { PATH: 'C:\\Windows', PSModulePath: 'C:\\pwsh\\Modules', psmodulepath: 'C:\\other' };
    expect(powershellEnvironment(env, ['C:\\a.exe'])).toEqual({ PATH: 'C:\\Windows', SIGNED_FILES: '["C:\\\\a.exe"]' });
  });
});
