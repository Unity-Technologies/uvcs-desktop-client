import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  TIMESTAMP_SERVER,
  azureSignToolArguments,
  azureSigningCredentials,
  signatureProblem,
} from './signWindows';

const ROOT = join(__dirname, '..', '..');
const signedConfig = readFileSync(join(ROOT, 'electron-builder.windows-signed.yml'), 'utf8');

const CREDENTIALS = {
  AZURE_KEY_VAULT_URI: 'https://vault.example.net/',
  AZURE_KEY_VAULT_CERTIFICATE: 'code-signing',
  AZURE_TENANT_ID: 'tenant-id',
  AZURE_CLIENT_ID: 'client-id',
  AZURE_CLIENT_SECRET: 'client-secret',
};

const SUBJECT = 'CN=Unity Technologies SF, O="Unity Technologies, Inc.", L=San Francisco, S=California, C=US';
const FILE = join('dist', 'UnityVersionControl-1.2.3-Windows-x64.exe');

/** `Get-AuthenticodeSignature | ConvertTo-Json -Compress` of a file, as Windows PowerShell prints it. */
function authenticodeJson(status: number, subject: string | null): string {
  return JSON.stringify({
    SignerCertificate: subject === null ? null : { Subject: subject, Issuer: 'CN=DigiCert EV Code Signing CA' },
    TimeStamperCertificate: null,
    Status: status,
    StatusMessage: status === 0 ? 'Signature verified.' : 'The file is not digitally signed.',
    Path: FILE,
  });
}

describe('the Windows signing credentials', () => {
  it('come from the environment', () => {
    expect(azureSigningCredentials({ ...CREDENTIALS, PATH: '/usr/bin' })).toEqual(CREDENTIALS);
  });

  it('name every variable that is missing or empty, and show no value', () => {
    const env = { ...CREDENTIALS, AZURE_TENANT_ID: '', AZURE_CLIENT_SECRET: undefined };
    expect(() => azureSigningCredentials(env)).toThrow(/needs AZURE_TENANT_ID, AZURE_CLIENT_SECRET \(/);
    expect(() => azureSigningCredentials(env)).not.toThrow(/client-id|vault\.example/);
  });

});

describe("AzureSignTool's arguments", () => {
  it('sign one file with the Key Vault certificate, SHA-256 and a timestamp', () => {
    expect(azureSignToolArguments(CREDENTIALS, FILE, 'Unity Version Control', 'https://unity.com')).toEqual([
      'sign',
      '--azure-key-vault-url', 'https://vault.example.net/',
      '--azure-key-vault-certificate', 'code-signing',
      '--azure-key-vault-tenant-id', 'tenant-id',
      '--azure-key-vault-client-id', 'client-id',
      '--azure-key-vault-client-secret', 'client-secret',
      '--file-digest', 'sha256',
      '--timestamp-rfc3161', TIMESTAMP_SERVER,
      '--timestamp-digest', 'sha256',
      '--description', 'Unity Version Control',
      '--description-url', 'https://unity.com',
      FILE,
    ]);
  });

  it('leave the description URL out when the app has none', () => {
    const args = azureSignToolArguments(CREDENTIALS, FILE, 'Unity Version Control', null);
    expect(args).not.toContain('--description-url');
    expect(args.at(-1)).toBe(FILE);
  });
});

describe("a signed file's check against the publisher updates expect", () => {
  it('passes when the publisher name is the signer common name', () => {
    expect(signatureProblem(FILE, authenticodeJson(0, SUBJECT), ['Unity Technologies SF'])).toBeNull();
  });

  it('passes when one of several names matches', () => {
    expect(signatureProblem(FILE, authenticodeJson(0, SUBJECT), ['Codice Software', 'Unity Technologies SF'])).toBeNull();
  });

  it('passes a full distinguished name only when every field it names matches', () => {
    expect(signatureProblem(FILE, authenticodeJson(0, SUBJECT), ['CN=Unity Technologies SF, C=US'])).toBeNull();
    expect(signatureProblem(FILE, authenticodeJson(0, SUBJECT), ['CN=Unity Technologies SF, C=DK'])).toMatch(/not by the publisher/);
  });

  it('fails a file signed by another name, saying who signed it', () => {
    const problem = signatureProblem(FILE, authenticodeJson(0, SUBJECT), ['Unity Technologies ApS']);
    expect(problem).toContain(`signed by "${SUBJECT}"`);
    expect(problem).toContain('(Unity Technologies ApS)');
  });

  it('fails a file whose signature is not valid', () => {
    expect(signatureProblem(FILE, authenticodeJson(1, SUBJECT), ['Unity Technologies SF'])).toMatch(/no valid signature \(status 1\)/);
  });

  it('fails a file with no signature', () => {
    expect(signatureProblem(FILE, authenticodeJson(2, null), ['Unity Technologies SF'])).toMatch(/no valid signature \(status 2\)/);
  });
});

describe('the signed Windows build (electron-builder.windows-signed.yml)', () => {
  it('extends the app build', () => {
    expect(signedConfig).toMatch(/^extends: \.\/electron-builder\.yml$/m);
  });

  it('signs through the hook, once, with SHA-256', () => {
    const hook = signedConfig.match(/^\s+sign: (\S+)$/m)?.[1];
    expect(hook).toBe('./scripts/build/signWindows.ts');
    expect(existsSync(join(ROOT, hook!))).toBe(true);
    expect(signedConfig).toMatch(/^\s+signingHashAlgorithms: \[sha256\]$/m);
  });

  it('names the publisher the updater will expect', () => {
    expect(signedConfig).toMatch(/^\s+publisherName: \S.*$/m);
  });
});
