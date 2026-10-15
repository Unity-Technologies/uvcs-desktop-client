// Image, not a paintbrush or a sparkle, for the Materials look: it shows the model's textures as pictures, and
// sparkles would read as an AI feature (`noAiLookalikeIcons.test.ts`).
import { Bone, Box, Focus, Grid3x3, Image, Palette, Shapes } from 'lucide-react';
import { hotkey } from '../../../../lib/shortcutRegistry';
import { StageButton, StageControls, StageSeparator } from '../image/StageControls';
import type { DrawMode } from './modelRenderer';
import { clickedSurface, materialsButtonLabel, surfaceButtonDisabledReason, surfaceButtonOn, type SurfaceLook } from './surfaceLook';

interface ModelViewControlsProps {
  drawMode: DrawMode;
  onDrawMode: (drawMode: DrawMode) => void;
  surface: SurfaceLook;
  onSurface: (surface: SurfaceLook) => void;
  /** Offered when the materials show more than the clay (`materialsOffered`). */
  materialsOffered: boolean;
  /** In Diffs: slot colors can't show, and the materials compare how the versions look. */
  differences: boolean;
  /** Offered when a version has bones. */
  bones: { shown: boolean; onShow: (shown: boolean) => void } | null;
  onFrame: () => void;
}

/**
 * The view's buttons, bottom right: framing, then Unity's Scene view draw modes, then what the surfaces show (slot
 * colors, materials: one choice, the clay when neither is on) and the bones.
 */
export function ModelViewControls({ drawMode, onDrawMode, surface, onSurface, materialsOffered, differences, bones, onFrame }: ModelViewControlsProps) {
  return (
    <StageControls>
      <StageButton icon={<Focus size={15} />} label="Frame the part picked, or the whole model" shortcut={hotkey('modelFrame')} onClick={onFrame} />
      <StageSeparator />
      <StageButton icon={<Box size={15} />} label="Shaded" active={drawMode === 'shaded'} onClick={() => onDrawMode('shaded')} />
      <StageButton icon={<Grid3x3 size={15} />} label="Wireframe" active={drawMode === 'wireframe'} onClick={() => onDrawMode('wireframe')} />
      <StageButton icon={<Shapes size={15} />} label="Shaded wireframe" active={drawMode === 'shadedWireframe'} onClick={() => onDrawMode('shadedWireframe')} />
      <StageSeparator />
      <StageButton
        icon={<Palette size={15} />}
        label="Color each material slot"
        active={surfaceButtonOn(surface, 'slotColors', differences)}
        unavailable={surfaceButtonDisabledReason('slotColors', differences)}
        onClick={() => onSurface(clickedSurface(surface, 'slotColors'))}
      />
      {materialsOffered && (
        <StageButton
          icon={<Image size={15} />}
          label={materialsButtonLabel(differences)}
          active={surfaceButtonOn(surface, 'materials', differences)}
          onClick={() => onSurface(clickedSurface(surface, 'materials'))}
        />
      )}
      {bones && <StageButton icon={<Bone size={15} />} label="Show the bones" active={bones.shown} onClick={() => bones.onShow(!bones.shown)} />}
    </StageControls>
  );
}
