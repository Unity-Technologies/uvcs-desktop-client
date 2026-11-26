import type { OfficialUpdate, OfficialUpdateMethod } from './officialUpdate';

/**
 * The `cm` the app runs (docs/features/cm-runtime.md): the one it downloads and keeps for itself, pinned per app
 * version, or one installed on the computer.
 */

/** Where the `cm` running comes from: the app's own, the one installed on the computer, or `UVCS_CM_PATH`. */
export type CmSource = 'managed' | 'installed' | 'environment';

/**
 * Which `cm` runs (docs/features/cm-runtime.md "Which cm runs"): `automatic`, the default while the user hasn't chosen,
 * runs the one installed on the computer when there is one and the app's own otherwise. In Settings the user chooses
 * the installed one (`installed`, which runs as `automatic` does) or always the app's own (`managed`).
 */
export type CmChoice = 'automatic' | 'installed' | 'managed';

/** What the user chooses in Settings, or on the setup's failure screen: `automatic` is only ever the default. */
export type CmUserChoice = Exclude<CmChoice, 'automatic'>;

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
  | 'unavailable'
  /**
   * It downloaded as published, but this computer didn't let it be unpacked or run: a policy that blocks programs in
   * the user's folders, a library missing, a file held by another program.
   */
  | 'blocked';

/**
 * Only the network's failures pass by themselves: those are tried again without the user (`installRetries`, and as
 * the page hears it's back online). The rest wait for the user to fix them and press Try Again.
 */
export function retriesByItself(failure: CmInstallFailure): boolean {
  return failure === 'offline' || failure === 'unreachable';
}

/** A `cm` installed on the computer: what runs by default, or what's offered when the app's own can't be set up. */
export interface InstalledCm {
  path: string;
  version: string;
}

/** The app's own `cm` downloading to replace the installed one, chosen in Settings, or why it couldn't. */
export type OwnCmSwitch = { kind: 'downloading'; fraction: number | null } | { kind: 'failed'; failure: CmInstallFailure; detail: string };

export type CmRuntimeStatus =
  /**
   * `cm` can run; its version is what `system.cmVersion` answers. While the installed one runs, the app's own may be
   * downloading to replace it (Settings' choice): the installed one keeps running until that's done.
   */
  | {
      kind: 'ready';
      source: CmSource;
      switchingToOwn?: OwnCmSwitch;
      /**
       * Where the app has no `cm` of its own (Linux on Arm), the installed one, older than the pinned version, which
       * nothing then runs: `CmUnavailableScreen` names both versions.
       */
      installedTooOld?: { installed: InstalledCm; requiredVersion: string };
      /** The installed one, too old, being updated from Settings. */
      officialUpdate?: OfficialUpdate;
      /** How the installed one is updated here, for Settings' too old card; none where it can't be from here. */
      updatesBy?: OfficialUpdateMethod;
    }
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
  /**
   * The installed `cm`, which runs by default, is older than the pinned version, the oldest the app runs: the update
   * screen asks to update it, or to run the app's own for now (docs/features/cm-runtime.md "The update screen").
   */
  | {
      kind: 'installedTooOld';
      installed: InstalledCm;
      requiredVersion: string;
      officialUpdate?: OfficialUpdate;
      /** How it's updated here: Update runs its installer, or the screen shows the command; none where it can't be from here. */
      updatesBy?: OfficialUpdateMethod;
    }
  | {
      kind: 'failed';
      version: string;
      failure: CmInstallFailure;
      /** What failed, for the details a user may copy into a bug report: the address and the error. */
      detail: string;
      firstRun: boolean;
      /** The `cm` installed on the computer, which the user may run instead; null when none was found or it's older than the app's own. */
      installedCm: InstalledCm | null;
    };

/**
 * The share of a setup's progress the download takes, on the setup screen's bar and the app's icon: the rest is for
 * unpacking and checking, which has no measure of its own.
 */
export const CM_SETUP_DOWNLOAD_SHARE = 0.9;

/** Compares two `cm` versions number by number (`11.0.16.9876` is older than `11.0.16.10659`): negative when `a` is older. */
export function compareCmVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * Whether a `cm` (its version as `cm version` prints it) can run this app: the version the app pins, or a newer one
 * (docs/features/cm-runtime.md "Which cm runs"). An older one may lack what any feature relies on, so none is run; one
 * whose version can't be read isn't either.
 */
export function meetsCmVersion(version: string, minimum: string): boolean {
  const readable = /^\d+(\.\d+)*$/.test(version.trim());
  return readable && compareCmVersions(version.trim(), minimum) >= 0;
}
