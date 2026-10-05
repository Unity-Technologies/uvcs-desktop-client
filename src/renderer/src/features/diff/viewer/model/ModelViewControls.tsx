import { Bone, Box, Focus, Grid3x3, Palette, Shapes } from 'lucide-react';
import { hotkey } from '../../../../lib/shortcutRegistry';
import { StageButton, StageControls, StageSeparator } from '../image/StageControls';
import type { DrawMode } from './modelRenderer';

interface ModelViewControlsProps {
  drawMode: DrawMode;
  onDrawMode: (drawMode: DrawMode) => void;
  colorBySlot: boolean;
  onColorBySlot: (colorBySlot: boolean) => void;
  /** Offered when a version has bones. */
  bones: { shown: boolean; onShow: (shown: boolean) => void } | null;
  onFrame: () => void;
}

/** The view's buttons, bottom right: framing, then Unity's Scene view draw modes, then the materials' colors and the bones. */
export function ModelViewControls({ drawMode, onDrawMode, colorBySlot, onColorBySlot, bones, onFrame }: ModelViewControlsProps) {
  return (
    <StageControls>
      <StageButton icon={<Focus size={15} />} label="Frame the part picked, or the whole model" shortcut={hotkey('modelFrame')} onClick={onFrame} />
      <StageSeparator />
      <StageButton icon={<Box size={15} />} label="Shaded" active={drawMode === 'shaded'} onClick={() => onDrawMode('shaded')} />
      <StageButton icon={<Grid3x3 size={15} />} label="Wireframe" active={drawMode === 'wireframe'} onClick={() => onDrawMode('wireframe')} />
      <StageButton icon={<Shapes size={15} />} label="Shaded wireframe" active={drawMode === 'shadedWireframe'} onClick={() => onDrawMode('shadedWireframe')} />
      <StageSeparator />
      <StageButton icon={<Palette size={15} />} label="Color each material slot" active={colorBySlot} onClick={() => onColorBySlot(!colorBySlot)} />
      {bones && <StageButton icon={<Bone size={15} />} label="Show the bones" active={bones.shown} onClick={() => bones.onShow(!bones.shown)} />}
    </StageControls>
  );
}
