import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { safeStorageCipher, TrackerSecrets, type SecretCipher } from './TrackerSecrets';

const reversing: SecretCipher = {
  canKeep: () => true,
  encrypt: (text) => Buffer.from([...text].reverse().join('')),
  decrypt: (data) => [...data.toString()].reverse().join(''),
};

function folder(): string {
  return mkdtempSync(join(tmpdir(), 'trackers-'));
}

describe('TrackerSecrets', () => {
  it('keeps a credential encrypted on disk, never in plain text', () => {
    const path = join(folder(), 'secrets.json');
    expect(new TrackerSecrets(path, reversing).keep('c1', { token: 'ghp_secret' })).toBe('kept');
    expect(readFileSync(path, 'utf8')).not.toContain('ghp_secret');
    const again = new TrackerSecrets(path, reversing);
    expect(again.state('c1')).toBe('kept');
    expect(again.read('c1')).toEqual({ token: 'ghp_secret' });
  });

  it('holds a credential for the session only where nothing can keep it, writing nothing', () => {
    const path = join(folder(), 'secrets.json');
    const secrets = new TrackerSecrets(path, { ...reversing, canKeep: () => false });
    expect(secrets.keep('c1', { token: 't' })).toBe('session');
    expect(secrets.read('c1')).toEqual({ token: 't' });
    expect(() => readFileSync(path)).toThrow();
    expect(new TrackerSecrets(path, reversing).state('c1')).toBe('missing');
  });

  it('takes a credential the keychain refuses to decrypt as missing', () => {
    const path = join(folder(), 'secrets.json');
    new TrackerSecrets(path, reversing).keep('c1', { token: 't' });
    const refusing = new TrackerSecrets(path, {
      ...reversing,
      decrypt: () => {
        throw new Error('The keychain refused');
      },
    });
    expect(refusing.read('c1')).toBeNull();
    expect(refusing.state('c1')).toBe('missing');
  });

  it('forgets a credential', () => {
    const path = join(folder(), 'secrets.json');
    const secrets = new TrackerSecrets(path, reversing);
    secrets.keep('c1', { token: 't' });
    secrets.forget('c1');
    expect(new TrackerSecrets(path, reversing).state('c1')).toBe('missing');
  });

  it('keeps nothing on Linux whose keyring is the plain-text backend', () => {
    const storage = { isEncryptionAvailable: () => true, getSelectedStorageBackend: () => 'basic_text', encryptString: () => Buffer.alloc(0), decryptString: () => '' };
    expect(safeStorageCipher(storage, 'linux').canKeep()).toBe(false);
    expect(safeStorageCipher({ ...storage, getSelectedStorageBackend: () => 'gnome_libsecret' }, 'linux').canKeep()).toBe(true);
    expect(safeStorageCipher(storage, 'darwin').canKeep()).toBe(true);
  });
});
