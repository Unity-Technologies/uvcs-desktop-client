import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  TIMESTAMP_SERVER,
  azureSigningCredentials,
  jsignArguments,
} from './signWindows';

const ROOT = join(__dirname, '..', '..');
const signedConfig = readFileSync(join(ROOT, 'electron-builder.windows-signed.yml'), 'utf8');

const CREDENTIALS = {
  AZURE_KEY_VAULT_URI: 'https://vault.example.net/',
  AZURE_KEY_VAULT_CERTIFICATE: 'code-signing',
  AZURE_KEY_VAULT_ACCESS_TOKEN: 'access-token',
  JSIGN_JAR: join('signing', 'jsign-7.5.jar'),
};

const FILE = join('dist', 'UnityVersionControl-1.2.3-Windows-x64.exe');

describe('the Windows signing credentials', () => {
  it('come from the environment', () => {
    expect(azureSigningCredentials({ ...CREDENTIALS, PATH: '/usr/bin' })).toEqual(CREDENTIALS);
  });

  it('name every variable that is missing or empty, and show no value', () => {
    const env = { ...CREDENTIALS, AZURE_KEY_VAULT_CERTIFICATE: '', AZURE_KEY_VAULT_ACCESS_TOKEN: undefined };
    expect(() => azureSigningCredentials(env)).toThrow(/needs AZURE_KEY_VAULT_CERTIFICATE, AZURE_KEY_VAULT_ACCESS_TOKEN \(/);
    expect(() => azureSigningCredentials(env)).not.toThrow(/access-token|vault\.example/);
  });
});

describe("jsign's arguments", () => {
  it('sign one file with the Key Vault certificate, SHA-256 and a retried timestamp, replacing any signature', () => {
    expect(jsignArguments(CREDENTIALS, FILE, 'Unity Version Control', 'https://unity.com')).toEqual([
      '-jar', CREDENTIALS.JSIGN_JAR,
      '--storetype', 'AZUREKEYVAULT',
      '--keystore', 'https://vault.example.net/',
      '--storepass', 'access-token',
      '--alias', 'code-signing',
      '--alg', 'SHA-256',
      '--tsaurl', TIMESTAMP_SERVER,
      '--tsmode', 'RFC3161',
      '--tsretries', '5',
      '--tsretrywait', '10',
      '--replace',
      '--name', 'Unity Version Control',
      '--url', 'https://unity.com',
      FILE,
    ]);
  });

  it('leave the URL out when the app has none', () => {
    const args = jsignArguments(CREDENTIALS, FILE, 'Unity Version Control', null);
    expect(args).not.toContain('--url');
    expect(args.at(-1)).toBe(FILE);
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
