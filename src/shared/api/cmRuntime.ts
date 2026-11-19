import type { CmChoice, CmRuntimeStatus, InstalledCm } from '../domain/cmRuntime';

/**
 * The `cm` the app runs (docs/features/cm-runtime.md): the app's own, set up on the first run and with updates, or the
 * one installed on the computer. Where it stands arrives as `cmRuntimeChanged` as it moves on.
 */
export interface CmRuntimeApi {
  /** Where it stands now, for a window that just opened. */
  status(): Promise<CmRuntimeStatus>;
  /** Tries setting up the app's own `cm` again, after it failed. */
  retry(): Promise<void>;
  /** Runs the installed `cm` from now on, or the app's own again; saved as the `cmChoice` setting. An installed one older than the app's own is refused. */
  use(choice: CmChoice): Promise<void>;
  /** The `cm` installed on the computer and its version (one `cm version` of it); null when there is none. */
  installedCm(): Promise<InstalledCm | null>;
  /** Shows the `cm` that runs in the OS's file manager (About, as Help ▸ Show Command Line Client). */
  reveal(): Promise<void>;
  /** The version of the app's own `cm`, the one this version of the app pins; null where it has none (Linux on Arm). */
  pinnedVersion(): Promise<string | null>;
}
