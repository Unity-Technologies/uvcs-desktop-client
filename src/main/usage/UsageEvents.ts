import type { CmClient } from '../cm/CmClient';
import { CmError } from '../cm/CmError';
import { textForLog } from '../cm/hideSecrets';
import { featureUseArgs, pingArgs, type PingDetails, type UsageFeature } from './usageEventArgs';

/** The other GUIs ping once an hour. */
export const PING_PERIOD_MS = 60 * 60 * 1000;

/** Runs `run` every `ms` until the returned function is called. */
export type Repeat = (run: () => unknown, ms: number) => () => void;

const repeatInBackground: Repeat = (run, ms) => {
  // `unref`: the pings never keep the app from quitting.
  const timer = setInterval(run, ms).unref();
  return () => clearInterval(timer);
};

/** What the services tell about the app's use (docs/features/usage-events.md). */
export interface UsageRecorder {
  /** A window shows the workspace: the pings start with the first one shown. */
  workspaceShown(workspacePath: string): void;
  /** The user asked for `feature` in the workspace (before it runs, as the other GUIs count it). */
  featureUsed(workspacePath: string, feature: UsageFeature): void;
}

/** Records nothing: for the tests of services that don't look at usage. */
export const NO_USAGE: UsageRecorder = { workspaceShown: () => undefined, featureUsed: () => undefined };

interface UsageEventsOptions {
  cm: Pick<CmClient, 'query' | 'hasReadyShell'>;
  /** The workspace of the window in front, which each hourly ping is for; undefined when none shows one. */
  workspaceInFront: () => string | undefined;
  pingDetails: () => PingDetails;
  repeat?: Repeat;
}

/**
 * Records the app's usage events with `cm trackevent`, in the workspace's pooled `cm shell` (`inPooledShell`): `cm`
 * stores them and that shell sends them to Unity as it does the other GUIs' (only for Cloud Edition), with the
 * organization and user of the workspace's server. The shells start naming the app and with their own pings off
 * (`SHELL_ARGS`): the app pings once an hour for the workspace in front, instead of each shell for its own.
 *
 * Best effort: recording never delays or fails what the user asked for. A `cm` that refuses it (one without
 * `trackevent`) stops it for the session rather than failing at every event; a shell closing under it doesn't.
 */
export class UsageEvents implements UsageRecorder {
  private stopPinging: (() => void) | undefined;
  private refused = false;

  constructor(private readonly options: UsageEventsOptions) {}

  /** The first ping waits for the workspace's shells, which its window just started (`workspaces.watch`). */
  workspaceShown(workspacePath: string): Promise<void> {
    if (this.stopPinging) return Promise.resolve();
    const repeat = this.options.repeat ?? repeatInBackground;
    this.stopPinging = repeat(() => this.pingWorkspaceInFront(), PING_PERIOD_MS);
    return this.ping(workspacePath);
  }

  featureUsed(workspacePath: string, feature: UsageFeature): Promise<void> {
    return this.record(workspacePath, featureUseArgs(feature));
  }

  dispose(): void {
    this.stopPinging?.();
  }

  /**
   * Skipped while the workspace's shells are let go (idle for minutes, `IDLE_DIRECTORY_MS`): waking two `cm shell`s for
   * a workspace nobody works in costs more than one hour's ping is worth.
   */
  private pingWorkspaceInFront(): Promise<void> {
    const workspacePath = this.options.workspaceInFront();
    if (workspacePath === undefined || !this.options.cm.hasReadyShell(workspacePath)) return Promise.resolve();
    return this.ping(workspacePath);
  }

  private ping(workspacePath: string): Promise<void> {
    return this.record(workspacePath, pingArgs(this.options.pingDetails()));
  }

  private async record(workspacePath: string, args: string[]): Promise<void> {
    if (this.refused) return;
    try {
      await this.options.cm.query(args, { cwd: workspacePath, inPooledShell: true });
    } catch (error) {
      // `cm` answered with an error; anything else (a shell closed with its window, one that crashed) passes.
      if (!(error instanceof CmError)) return;
      this.refused = true;
      console.warn('[usage events] Not recorded from now on:', textForLog(error.message));
    }
  }
}
