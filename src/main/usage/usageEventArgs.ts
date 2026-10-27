/**
 * The usage events the app records through `cm trackevent` (docs/features/usage-events.md): the events the other UVCS
 * GUIs record, named as they name them, so their use can be compared by application.
 */

/** The features whose use is recorded, as Feature Use events name them. */
export type UsageFeature = 'checkin' | 'undo';

/** What a ping says of how the app looks, as the other GUIs' pings say it. */
export interface PingDetails {
  dark: boolean;
  /** The primary display's size in physical pixels. */
  screen: { width: number; height: number };
}

export function featureUseArgs(feature: UsageFeature): string[] {
  return ['trackevent', 'featureuse', feature];
}

export function pingArgs(details: PingDetails): string[] {
  return ['trackevent', 'ping', `--extrainfo=${pingExtraInfo(details)}`];
}

/**
 * `key=value` pairs joined by `:`, `cm` puts them after the OS version. The theme is written `Light` or `Dark`, as the
 * other GUIs write theirs.
 */
export function pingExtraInfo({ dark, screen }: PingDetails): string {
  return [`theme=${dark ? 'Dark' : 'Light'}`, `screenresolution=${screen.width}x${screen.height}`].join(':');
}
