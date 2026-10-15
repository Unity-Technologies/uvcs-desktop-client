// Plays a model's takes, both versions on one timeline: pick a take, play or scrub, and see what an animator changed
// move side by side (or blended, or swiped). Each version plays its own take of that name at its own length; a take
// only one version has plays there, the other keeps its rest pose and the bar says so. It starts at the rest pose,
// so a diff opens still; leaving it, or going back to the rest pose, puts every node back. What of a take the viewer
// can't play (a node it hasn't, blendshapes of a mesh without them: `playableTake`) is left out, and the bar says so.

import { Clapperboard, Pause, Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimationClip, AnimationMixer } from 'three';
import { ChoiceChip } from '../../../../ui/ChoiceChip';
import { PillButton } from '../image/stage';
import { choiceLength, timeInTake, type ClipChoice } from './modelClips';
import { playableTake, unplayableWords, type PlayableTake } from './playableTake';
import type { ModelRenderer } from './modelRenderer';
import type { ModelScene } from './modelScene';
import type { ModelClip } from './parsedModel';
import styles from './ModelAnimationBar.module.css';

/** The choice that plays nothing: every node where the file has it. */
const REST_POSE = '\u0000rest';

interface ModelAnimationBarProps {
  renderer: ModelRenderer;
  scenes: { before: ModelScene | null; after: ModelScene | null };
  choices: ClipChoice[];
  /** Both versions are there: a take only one has is told so (a model added or deleted has only its own). */
  comparable: boolean;
  /** The take picked, by name; null for the rest pose. Owned by the viewer, as "What changed" picks takes too. */
  take: string | null;
  onTake: (take: string | null) => void;
}

export function ModelAnimationBar({ renderer, scenes, choices, comparable, take: picked, onTake }: ModelAnimationBarProps) {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  // A take picked, here or in "What changed", plays; the rest pose stands still.
  const [playingFor, setPlayingFor] = useState(picked);
  if (playingFor !== picked) {
    setPlayingFor(picked);
    setPlaying(picked !== null);
  }
  const choice = choices.find((candidate) => candidate.name === picked) ?? null;
  const length = choice ? choiceLength(choice) : 0;
  const mixers = useMemo(() => ({ before: scenes.before && new AnimationMixer(scenes.before.root), after: scenes.after && new AnimationMixer(scenes.after.root) }), [scenes.before, scenes.after]);
  const takes = useMemo(
    () => ({ before: playableOn(scenes.before, choice?.before), after: playableOn(scenes.after, choice?.after) }),
    [scenes.before, scenes.after, choice],
  );

  // Each version's take of the choice, set playing; the rest pose first, so a node the take doesn't key stays put.
  useEffect(() => {
    for (const side of ['before', 'after'] as const) {
      const mixer = mixers[side];
      scenes[side]?.resetPose();
      mixer?.stopAllAction();
      const take = takes[side];
      if (mixer && take) mixer.clipAction(take.clip).play();
    }
    seek(mixers, choice, 0);
    setTime(0);
    renderer.requestRender();
    return () => {
      for (const side of ['before', 'after'] as const) {
        mixers[side]?.stopAllAction();
        scenes[side]?.resetPose();
      }
      renderer.requestRender();
    };
  }, [mixers, choice, takes, scenes, renderer]);

  // Playing: the timeline runs with the clock, every version seeking to it each frame.
  const latest = useRef(time);
  latest.current = time;
  useEffect(() => {
    if (!playing || length === 0) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      const next = (latest.current + (now - last) / 1000) % length;
      last = now;
      seek(mixers, choice, next);
      setTime(next);
      renderer.requestRender();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, length, mixers, choice, renderer]);

  const onScrub = (value: number): void => {
    setPlaying(false);
    seek(mixers, choice, value);
    setTime(value);
    renderer.requestRender();
  };

  const unplayable = unplayableWords([...(takes.before?.dropped ?? []), ...(takes.after?.dropped ?? [])]);
  const only = comparable && choice && !(choice.before && choice.after) ? (choice.after ? 'Only in the version after' : 'Only in the version before') : null;
  return (
    <div className={styles.bar} data-no-pan>
      <ChoiceChip
        icon={<Clapperboard size={13} />}
        value={choice ? choice.name : REST_POSE}
        neutralValue={REST_POSE}
        onChange={(value) => onTake(value === REST_POSE ? null : value)}
        choices={[{ value: REST_POSE, label: 'Rest pose' }, ...choices.map((candidate) => ({ value: candidate.name, label: candidate.name }))]}
      />
      {choice && (
        <>
          <PillButton prominent icon={playing ? <Pause size={14} /> : <Play size={14} />} label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying((value) => !value)} />
          <input
            className={styles.scrubber}
            type="range"
            min={0}
            max={length}
            step={length / 1000}
            value={time}
            aria-label="Time in the take"
            onChange={(event) => onScrub(Number(event.target.value))}
          />
          <span className={styles.time}>
            {time.toFixed(2)} / {length.toFixed(2)} s
          </span>
          {only && <span className={styles.note} title={only}>{only}</span>}
          {unplayable && <span className={styles.note} title={unplayable}>{unplayable}</span>}
        </>
      )}
    </div>
  );
}

function seek(mixers: Record<'before' | 'after', AnimationMixer | null>, choice: ClipChoice | null, time: number): void {
  for (const side of ['before', 'after'] as const) {
    const take = choice?.[side];
    if (take) mixers[side]?.setTime(timeInTake(take, time));
  }
}

/** Each take parsed (its tracks are three's clip JSON) and cut to what a scene can play, once per scene and take. */
const playables = new WeakMap<ModelScene, WeakMap<ModelClip, PlayableTake>>();
function playableOn(scene: ModelScene | null, take: ModelClip | undefined): PlayableTake | null {
  if (!scene || !take) return null;
  let ofScene = playables.get(scene);
  if (!ofScene) playables.set(scene, (ofScene = new WeakMap()));
  let playable = ofScene.get(take);
  if (!playable) ofScene.set(take, (playable = playableTake(AnimationClip.parse(take.tracks), scene)));
  return playable;
}
