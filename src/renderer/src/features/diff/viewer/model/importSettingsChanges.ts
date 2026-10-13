// What a model's import settings (its `.meta`) do with it that no longer fits it after a change: a material remapped
// onto a slot it doesn't have, a Humanoid avatar mapping a bone it doesn't have, a clip cut past its take's end or
// from a take it doesn't have; and its Scale Factor changed. Each is told only when this change broke it: what was
// broken before is not news. These break a Unity project without an error in the model itself.

import type { ModelChange } from './modelChanges';
import type { ModelImportSettings } from './modelImportSettings';
import type { ModelSummary } from './modelSummary';

export interface ImportedVersion {
  summary: ModelSummary;
  settings: ModelImportSettings;
}

/** A take with no frame rate (glTF) is counted at the FBX SDK's default. */
const DEFAULT_FRAME_RATE = 30;

export function importSettingsChanges(before: ImportedVersion, after: ImportedVersion): ModelChange[] {
  const changes: ModelChange[] = [];
  const scale = (settings: ModelImportSettings) => ({ scaleFactor: settings.scaleFactor, convertUnits: settings.convertUnits });
  if (before.settings.scaleFactor !== after.settings.scaleFactor || before.settings.convertUnits !== after.settings.convertUnits) {
    changes.push({ kind: 'scaleFactor', before: scale(before.settings), after: scale(after.settings) });
  }
  const brokenBefore = new Set(brokenBy(before).map(keyOf));
  return [...changes, ...brokenBy(after).filter((change) => !brokenBefore.has(keyOf(change)))];
}

/** Every setting that doesn't fit its version of the model. */
function brokenBy({ summary, settings }: ImportedVersion): ModelChange[] {
  const slots = new Set(summary.meshes.flatMap((mesh) => mesh.slots));
  const names = new Set(summary.nodes.map((node) => node.name));
  const takes = new Map(summary.clips.map((clip) => [clip.name, clip.duration]));
  const frameRate = summary.frameRate ?? DEFAULT_FRAME_RATE;
  const broken: ModelChange[] = [];
  for (const { slot } of settings.materialRemaps) if (!slots.has(slot)) broken.push({ kind: 'remapLost', slot });
  if (settings.humanoid) {
    for (const { humanName, boneName } of settings.humanBones) if (!names.has(boneName)) broken.push({ kind: 'avatarBoneLost', humanName, boneName });
  }
  for (const clip of settings.clips) {
    const duration = takes.get(clip.takeName);
    if (duration === undefined) {
      broken.push({ kind: 'clipTakeLost', clip: clip.name, take: clip.takeName });
      continue;
    }
    const takeFrames = Math.round(duration * frameRate);
    if (clip.lastFrame > takeFrames) broken.push({ kind: 'clipPastTake', clip: clip.name, take: clip.takeName, lastFrame: clip.lastFrame, takeFrames });
  }
  return broken;
}

function keyOf(change: ModelChange): string {
  return JSON.stringify(change);
}
