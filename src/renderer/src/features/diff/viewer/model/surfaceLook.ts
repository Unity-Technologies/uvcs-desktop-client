// What the model's surfaces show, one choice of three: clay (the default), each material slot in its color, or the
// materials and textures as Unity would show them, from the workspace (docs/features/model-diff.md, "Materials").
// Two adjacent stage buttons choose it: the one on turns the other off, and the one on clicked again goes back to clay.
// In Diffs, the materials shown make it compare how the versions look; slot colors can't show there.

export type SurfaceLook = 'clay' | 'slotColors' | 'materials';

/** What Diffs compares: how far the shape moved (the heatmap on clay), or how the versions look with their materials. */
export type DiffsCompares = 'shape' | 'look';

/** The choice after a click on a look's button. */
export function clickedSurface(current: SurfaceLook, clicked: Exclude<SurfaceLook, 'clay'>): SurfaceLook {
  return current === clicked ? 'clay' : clicked;
}

/** What Diffs compares with this look shown: the look with the materials, the shape otherwise. */
export function diffsCompares(shown: SurfaceLook): DiffsCompares {
  return shown === 'materials' ? 'look' : 'shape';
}

/** Why a look's button is off, in its tooltip; null while it can be used. In Diffs, slot colors would hide its colors. */
export function surfaceButtonDisabledReason(button: Exclude<SurfaceLook, 'clay'>, differences: boolean): string | null {
  return differences && button === 'slotColors' ? 'Off in Diffs: its colors show what changed' : null;
}

/** Whether a look's button shows on: its look chosen, and the button usable. */
export function surfaceButtonOn(surface: SurfaceLook, button: Exclude<SurfaceLook, 'clay'>, differences: boolean): boolean {
  return surface === button && surfaceButtonDisabledReason(button, differences) === null;
}

/** The materials button's name: in Diffs it compares how the versions look. */
export function materialsButtonLabel(differences: boolean): string {
  return differences ? 'Compare materials and textures' : 'Show materials and textures';
}

/**
 * What the surfaces show: the choice kept, but clay where the materials can't show (the look isn't offered for this
 * model). Diffs draws its heatmap for clay and slot colors, and slot colors come back in the other modes.
 */
export function shownSurface(chosen: SurfaceLook, materialsOffered: boolean): SurfaceLook {
  return chosen === 'materials' && !materialsOffered ? 'clay' : chosen;
}

/** The choice a store kept before there were materials: `modelColorBySlot`, true for slot colors. */
export function surfaceFromColorBySlot(colorBySlot: unknown): SurfaceLook {
  return colorBySlot === true ? 'slotColors' : 'clay';
}
