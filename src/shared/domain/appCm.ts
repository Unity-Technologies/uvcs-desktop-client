/**
 * The `cm` the app runs (docs/features/app-cm.md): the one it downloads and keeps for itself, pinned per app
 * version, or one installed on the computer.
 */

/** Where the `cm` running comes from: the app's own, the one installed on the computer, or `UVCS_CM_PATH`. */
export type CmSource = 'app' | 'installed' | 'environment';

/** Which `cm` the user chose in Settings: the app's own (the default), or the one installed on the computer. */
export type CmChoice = 'app' | 'installed';

/** Why the app's `cm` couldn't be set up, each said to the user in its own plain words. */
export type CmInstallFailure =
  /** No network: the computer is offline, or names can't be resolved. Retried by itself once back online. */
  | 'offline'
  /** The network works, but the download site didn't answer, or answered with an error. */
  | 'unreachable'
  /** A proxy asks for a sign-in the app can't give. */
  | 'proxyAuthentication'
  /** The disk is full. */
  | 'diskFull'
  /** The folder the app keeps it in can't be written. */
  | 'notWritable'
  /** What was downloaded isn't what was published: its SHA-256 differs, it doesn't unpack or it isn't that version. */
  | 'damaged'
  /** The download site doesn't have that version (any more). */
  | 'unavailable';

/** A `cm` installed on the computer, offered when the app's own can't be set up. */
export interface InstalledCm {
  path: string;
  version: string;
}

export type CmRuntimeStatus =
  /** `cm` can run; its version is what `system.cmVersion` answers. */
  | { kind: 'ready'; source: CmSource }
  | {
      kind: 'installing';
      version: string;
      /** The downloading, then the unpacking and checking that finish it. */
      phase: 'downloading' | 'finishing';
      receivedBytes: number;
      /** Null until the download site says how large the bundle is. */
      totalBytes: number | null;
      /** True when no `cm` of the app's was ever set up before: setting up, rather than updating. */
      firstRun: boolean;
    }
  | {
      kind: 'failed';
      version: string;
      failure: CmInstallFailure;
      /** What failed, for the details a user may copy into a bug report: the address and the error. */
      detail: string;
      firstRun: boolean;
      /** The `cm` installed on the computer, which the user may run instead; null when none was found. */
      installedCm: InstalledCm | null;
    };
