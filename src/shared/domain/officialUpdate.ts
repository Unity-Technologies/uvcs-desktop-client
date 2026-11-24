/**
 * Updating the official installation of Unity Version Control, the one installed on the computer, to a version the app
 * runs (docs/features/cm-runtime.md "Updating the installed one"): its own edition's installer, downloaded, checked
 * and run as the official client updates itself.
 */

/** Why the installed one couldn't be updated, each said to the user in its own plain words. */
export type OfficialUpdateFailure =
  /** The download site has nothing newer than what's installed, or nothing as new as the app needs. */
  | 'noUpdate'
  /** The download site didn't answer, or the download stopped. */
  | 'unreachable'
  /** What was downloaded isn't signed by Unity: it isn't run. */
  | 'notSigned'
  /** The user didn't give the installer the permission it asked for. */
  | 'declined'
  /** The installer ended and the version installed is still too old: another app held it, or this computer refused. */
  | 'notUpdated';

export type OfficialUpdate =
  /** Asking the download site for the latest version of the installed edition. */
  | { kind: 'lookingUp'; installRequested: boolean }
  /** Downloading its installer, in the background or because the user asked to install it (`installRequested`). */
  | { kind: 'downloading'; version: string; receivedBytes: number; totalBytes: number | null; installRequested: boolean }
  /** The installer is downloaded, waiting for the user's click. */
  | { kind: 'downloaded'; version: string }
  /** The installer runs: the app waits for it to end. */
  | { kind: 'installing'; version: string }
  | {
      kind: 'failed';
      failure: OfficialUpdateFailure;
      /** The version it tried to install, when it got that far. */
      version: string | null;
      /** What failed, for the details a user may copy into a bug report. */
      detail: string;
    }
  /** Linux: no installer; the user updates the package that holds it with this command. */
  | { kind: 'byCommand'; command: string };
