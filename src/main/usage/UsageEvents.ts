import type { CmClient } from '../cm/CmClient';
import { textForLog } from '../cm/hideSecrets';
import { featureUseArgs, pingArgs, type PingDetails, type UsageFeature } from './usageEventArgs';

/** The other GUIs ping once an hour. */
export const PING_PERIOD_MS = 60 * 60 * 1000;

/** Runs `run` every `ms` until the returned function is called. */
export type Repeat = (run: () => void, ms: number) => () => void;

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
  cm: Pick<CmClient, 'query'>;
  /** The workspace of the window in front, which each hourly ping is for; undefined when none shows one. */
  workspaceInFront: () => string | undefined;
  pingDetails: () => PingDetails;
  repeat?: Repeat;
}

/**
 * Records the app's usage events with `cm trackevent`, in the workspace's `cm shell`: `cm` stores them and sends them to
 * Unity as it does the other GUIs' (only for Cloud Edition), with the organization and user of the workspace's server.
 * The shells start naming the app and with their own pings off (`SHELL_ARGS`): the app pings once an hour for the
 * workspace in front, instead of each shell for its own.
 *
 * Best effort: recording never delays or fails what the user asked for, and the first failure (a `cm` without
 * `trackevent`) stops it for the session rather than failing at every event.
 */
export class UsageEvents implements UsageRecorder {
  private stopPinging: (() => void) | undefined;
  private failed = false;

  constructor(private readonly options: UsageEventsOptions) {}

  workspaceShown(workspacePath: string): void {
    if (this.stopPinging) return;
    const repeat = this.options.repeat ?? repeatInBackground;
    this.stopPinging = repeat(() => this.pingWorkspaceInFront(), PING_PERIOD_MS);
    this.ping(workspacePath);
  }

  featureUsed(workspacePath: string, feature: UsageFeature): void {
    this.record(workspacePath, featureUseArgs(feature));
  }

  dispose(): void {
    this.stopPinging?.();
  }

  private pingWorkspaceInFront(): void {
    const workspacePath = this.options.workspaceInFront();
    if (workspacePath !== undefined) this.ping(workspacePath);
  }

  private ping(workspacePath: string): void {
    this.record(workspacePath, pingArgs(this.options.pingDetails()));
  }

  private record(workspacePath: string, args: string[]): void {
    if (this.failed) return;
    this.options.cm.query(args, { cwd: workspacePath }).catch((error: unknown) => {
      this.failed = true;
      console.warn('[usage events] Not recorded from now on:', textForLog(String(error)));
    });
  }
}
