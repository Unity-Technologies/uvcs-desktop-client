import { stableHueIndex } from './stableHue';

/**
 * The avatar fills of `styles/tokens.css`, one per `STABLE_HUES` hue and in their order, so a name keeps its color
 * family: each carries its white initial (`--avatar-letter`) at 4.5:1 (`tokens.test.ts`).
 */
export const AVATAR_COLORS = [
  '--avatar-blue',
  '--avatar-cyan',
  '--avatar-teal',
  '--avatar-green',
  '--avatar-lime',
  '--avatar-amber',
  '--avatar-orange',
  '--avatar-red',
  '--avatar-rose',
  '--avatar-pink',
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];

/** The fill of the avatar of a name (a person, a repository), the same wherever it shows. */
export function avatarColorOf(name: string): AvatarColor {
  return AVATAR_COLORS[stableHueIndex(name)]!;
}
