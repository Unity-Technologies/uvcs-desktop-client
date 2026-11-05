import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { replaceFileSync } from '../files/replaceFileSync';

/** What signs in to a tracker: a token, and for Jira Cloud the account's email it goes with. */
export interface TrackerCredential {
  token: string;
  email?: string;
}

/** The system's encryption (`safeStorage`), passed in so tests use their own. */
export interface SecretCipher {
  /** Whether what it encrypts is safe to write: false on Linux without a keyring, where it would be plain text. */
  canKeep(): boolean;
  encrypt(text: string): Buffer;
  /** Throws when the keychain refuses, or the key changed. */
  decrypt(data: Buffer): string;
}

interface SafeStorage {
  isEncryptionAvailable(): boolean;
  getSelectedStorageBackend?(): string;
  encryptString(text: string): Buffer;
  decryptString(data: Buffer): string;
}

/**
 * Electron's `safeStorage` as a `SecretCipher`. On Linux, a `basic_text` backend means no keyring: its "encryption"
 * is a fixed key, plain text in all but name, so nothing is kept.
 */
export function safeStorageCipher(safeStorage: SafeStorage, platform: NodeJS.Platform): SecretCipher {
  return {
    canKeep: () => safeStorage.isEncryptionAvailable() && !(platform === 'linux' && safeStorage.getSelectedStorageBackend?.() === 'basic_text'),
    encrypt: (text) => safeStorage.encryptString(text),
    decrypt: (data) => safeStorage.decryptString(data),
  };
}

/**
 * The connections' credentials (docs/features/issue-trackers.md, "Secrets"): encrypted by the system's keychain in a
 * file of their own, or held in memory for the session when it can't keep them. Read only by main, and only once a
 * connection asks: a user with none never touches the keychain.
 */
export class TrackerSecrets {
  private kept: Record<string, string> | null = null;
  private readonly session = new Map<string, TrackerCredential>();
  /** Credentials the keychain refused to decrypt this session: `missing` until signed in again. */
  private readonly undecryptable = new Set<string>();

  constructor(
    private readonly filePath: string,
    private readonly cipher: SecretCipher,
  ) {}

  /** Whether credentials can be kept past the session on this computer. */
  canKeep(): boolean {
    return this.cipher.canKeep();
  }

  /** Keeps a connection's credential: on disk, encrypted, or in memory when it can't be. */
  keep(connectionId: string, credential: TrackerCredential): 'kept' | 'session' {
    this.undecryptable.delete(connectionId);
    if (!this.cipher.canKeep()) {
      this.session.set(connectionId, credential);
      return 'session';
    }
    this.session.delete(connectionId);
    this.write({ ...this.stored(), [connectionId]: this.cipher.encrypt(JSON.stringify(credential)).toString('base64') });
    return 'kept';
  }

  read(connectionId: string): TrackerCredential | null {
    const inSession = this.session.get(connectionId);
    if (inSession) return inSession;
    const encrypted = this.stored()[connectionId];
    if (!encrypted || this.undecryptable.has(connectionId)) return null;
    try {
      return JSON.parse(this.cipher.decrypt(Buffer.from(encrypted, 'base64'))) as TrackerCredential;
    } catch {
      this.undecryptable.add(connectionId);
      return null;
    }
  }

  /** Whether a credential is there to use, without decrypting it. */
  state(connectionId: string): 'kept' | 'session' | 'missing' {
    if (this.session.has(connectionId)) return 'session';
    return this.stored()[connectionId] && !this.undecryptable.has(connectionId) ? 'kept' : 'missing';
  }

  forget(connectionId: string): void {
    this.session.delete(connectionId);
    this.undecryptable.delete(connectionId);
    const { [connectionId]: _forgotten, ...rest } = this.stored();
    if (_forgotten !== undefined) this.write(rest);
  }

  private stored(): Record<string, string> {
    if (this.kept) return this.kept;
    try {
      this.kept = JSON.parse(readFileSync(this.filePath, 'utf8')) as Record<string, string>;
    } catch {
      this.kept = {};
    }
    return this.kept;
  }

  private write(kept: Record<string, string>): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    replaceFileSync(this.filePath, JSON.stringify(kept));
    this.kept = kept;
  }
}
