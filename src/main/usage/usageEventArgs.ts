/**
 * The usage events the app records through `cm trackevent` (docs/features/usage-events.md): the events the other UVCS
 * GUIs record, named as they name them, so their use can be compared by application.
 */

/** The features whose use is recorded, as Feature Use events name them. */
export type UsageFeature = 'checkin' | 'undo';

interface Size {
  width: number;
  height: number;
}

/** What a ping says of how the app looks, as the other GUIs' pings say it. */
export interface PingDetails {
  dark: boolean;
  /** The primary display's size in physical pixels (`physicalSize`). */
  screen: Size;
}

export function featureUseArgs(feature: UsageFeature): string[] {
  return ['trackevent', 'featureuse', feature];
}

export function pingArgs(details: PingDetails): string[] {
  return ['trackevent', 'ping', `--extrainfo=${pingExtraInfo(details)}`];
}

/**
 * `key=value` pairs joined by `:`, which `cm` puts after the OS version, in the order the other GUIs write them. The
 * theme is written `Light` or `Dark`, as theirs.
 */
export function pingExtraInfo({ dark, screen }: PingDetails): string {
  return [`screenresolution=${screen.width}x${screen.height}`, `theme=${dark ? 'Dark' : 'Light'}`].join(':');
}

/**
 * A display's size in physical pixels, as the other GUIs report it: Electron gives it in device-independent pixels and
 * the scale factor (1.25, 1.5 on Windows), and the product isn't always whole.
 */
export function physicalSize(size: Size, scaleFactor: number): Size {
  return { width: Math.round(size.width * scaleFactor), height: Math.round(size.height * scaleFactor) };
}
