// The takes a model diff can play: matched by name across the versions (as Unity's clips name the take they're cut
// from), in the version after's order, the takes only the version before has last. One timeline drives both: each
// version plays its own take's length, looping, so a take made shorter is seen ending sooner.

import type { ModelClip } from './parsedModel';

export interface ClipChoice {
  name: string;
  /** Each version's take of that name; absent on the side that hasn't it. */
  before?: ModelClip;
  after?: ModelClip;
}

export function clipChoices(before: ModelClip[], after: ModelClip[]): ClipChoice[] {
  const ofBefore = new Map(before.map((clip) => [clip.name, clip]));
  const choices: ClipChoice[] = after.map((clip) => ({ name: clip.name, after: clip, ...(ofBefore.has(clip.name) && { before: ofBefore.get(clip.name)! }) }));
  const named = new Set(after.map((clip) => clip.name));
  for (const clip of before) if (!named.has(clip.name)) choices.push({ name: clip.name, before: clip });
  return choices;
}

/** The longest of the choice's takes: the timeline's length. */
export function choiceLength(choice: ClipChoice): number {
  return Math.max(choice.before?.duration ?? 0, choice.after?.duration ?? 0);
}

/** Where a take is at the timeline's `time`: its own length looped, so each version plays at its own pace. */
export function timeInTake(clip: ModelClip, time: number): number {
  return clip.duration > 0 ? time % clip.duration : 0;
}
