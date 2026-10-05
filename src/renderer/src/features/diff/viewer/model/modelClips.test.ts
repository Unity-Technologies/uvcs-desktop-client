import { AnimationClip } from 'three';
import { describe, expect, it } from 'vitest';
import { choiceLength, clipChoices, timeInTake } from './modelClips';
import type { ModelClip } from './parsedModel';

const clip = (name: string, duration: number): ModelClip => ({ name, duration, tracks: AnimationClip.toJSON(new AnimationClip(name, duration, [])) });

describe('clipChoices', () => {
  it("matches the versions' takes by name, the version after's order first, then what only the version before has", () => {
    const choices = clipChoices([clip('Idle', 2), clip('Run', 1.2)], [clip('Run', 0.9), clip('Jump', 0.6)]);
    expect(choices.map((choice) => [choice.name, choice.before?.duration ?? null, choice.after?.duration ?? null])).toEqual([
      ['Run', 1.2, 0.9],
      ['Jump', null, 0.6],
      ['Idle', 2, null],
    ]);
  });
});

describe('the timeline', () => {
  it('is as long as the longest take, and plays each at its own length, looping', () => {
    const [run] = clipChoices([clip('Run', 1.2)], [clip('Run', 0.9)]);
    expect(choiceLength(run!)).toBe(1.2);
    expect(timeInTake(run!.after!, 1)).toBeCloseTo(0.1);
    expect(timeInTake(run!.before!, 1)).toBeCloseTo(1);
    expect(timeInTake(clip('Pose', 0), 3)).toBe(0);
  });
});
