// What the model's surfaces show, one choice of three: clay (the default), each material slot in its color, or the
// materials and textures as Unity would show them, from the workspace (docs/features/model-diff.md, "Materials").
// Two adjacent stage buttons choose it: the one on turns the other off, and the one on clicked again goes back to clay.

export type SurfaceLook = 'clay' | 'slotColors' | 'materials';

/** The choice after a click on a look's button. */
export function clickedSurface(current: SurfaceLook, clicked: Exclude<SurfaceLook, 'clay'>): SurfaceLook {
  return current === clicked ? 'clay' : clicked;
}

/** Why a look's button is off, in its tooltip; null while it can be used. Diffs colors the model its own way. */
export function surfaceButtonDisabledReason(differences: boolean): string | null {
  return differences ? 'Diffs colors the model by how far it moved' : null;
}

/**
 * What the surfaces show: the choice kept, but clay where the materials can't show (the look isn't offered for this
 * model). Diffs mode draws its heatmap whatever this says, and the choice comes back in the other modes.
 */
export function shownSurface(chosen: SurfaceLook, materialsOffered: boolean): SurfaceLook {
  return chosen === 'materials' && !materialsOffered ? 'clay' : chosen;
}

/** The choice a store kept before there were materials: `modelColorBySlot`, true for slot colors. */
export function surfaceFromColorBySlot(colorBySlot: unknown): SurfaceLook {
  return colorBySlot === true ? 'slotColors' : 'clay';
}
