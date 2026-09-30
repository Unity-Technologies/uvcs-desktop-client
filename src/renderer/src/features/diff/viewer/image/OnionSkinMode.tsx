// Onion skin: the new revision is layered over the old one and a slider
// blends between them — the classic way to spot what moved. Play automates
// the slider: the blend snaps between all-before and all-after at 2 Hz (the
// comparator's blink — the eye is a superb motion detector, so anything that
// moved pops). The cut is hard, never a fade: easing would smear exactly the
// pop the eye keys on. The thumb visibly jumps with each cut, so the feature
// explains itself; touching the slider pauses playback.

import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AnchorMode, Size } from './composedFrame';
import { ImageLayer, Pill, PillButton, PillLabel, Viewport, World } from './stage';
import type { DecodedImage } from './useDecodedImage';
import type { PanZoom } from './usePanZoom';
import styles from './OnionSkinMode.module.css';

/** Half a blink period: each revision holds the screen this long. */
const BLINK_INTERVAL_MS = 500;

interface OnionSkinModeProps {
  oldImage: DecodedImage;
  newImage: DecodedImage;
  frame: Size;
  panZoom: PanZoom;
  anchor: AnchorMode;
  /** 0 = all before, 1 = all after. Owned by the viewer so it survives mode trips. */
  blend: number;
  onBlendChange: (blend: number) => void;
}

export function OnionSkinMode({ oldImage, newImage, frame, panZoom, anchor, blend, onBlendChange }: OnionSkinModeProps) {
  const [playing, setPlaying] = useState(false);
  // The interval toggles from the latest blend without retriggering the
  // effect on every cut (the effect must only restart on play/pause).
  const blendRef = useRef(blend);
  blendRef.current = blend;

  useEffect(() => {
    if (!playing) return;
    const snap = () => onBlendChange(blendRef.current >= 0.5 ? 0 : 1);
    // Snap immediately so pressing play responds on the spot, not 500ms later.
    snap();
    const id = setInterval(snap, BLINK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing, onBlendChange]);

  return (
    <Viewport panZoom={panZoom}>
      <World panZoom={panZoom} frame={frame}>
        <ImageLayer image={oldImage} frame={frame} side="old" anchor={anchor} />
        <ImageLayer image={newImage} frame={frame} side="new" anchor={anchor} opacity={blend} />
      </World>
      <Pill>
        <PillButton
          prominent
          icon={playing ? <Pause size={14} /> : <Play size={14} />}
          label={playing ? 'Pause' : 'Blink between before and after'}
          onClick={() => setPlaying((value) => !value)}
        />
        <PillLabel>Before</PillLabel>
        <input
          className={styles.slider}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={blend}
          aria-label="Blend between the before and after images"
          onChange={(event) => {
            // A manual blend is the user taking the wheel: stop blinking.
            setPlaying(false);
            onBlendChange(Number(event.target.value));
          }}
        />
        <PillLabel>After</PillLabel>
      </Pill>
    </Viewport>
  );
}
