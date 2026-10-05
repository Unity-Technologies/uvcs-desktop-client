// The Differences mode's pills, as the image diff's: the tolerance (how far a vertex may move and still count as
// unchanged: a re-export's rounding, a smoothing pass), and ‹ › through the changed regions, biggest first.

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { regionCounter } from '../image/changedRegions';
import { Pill, PillButton, PillLabel, PillValue } from '../image/stage';
import { formatLength } from './modelUnits';
import styles from './ModelDifferencesControls.module.css';

/** The slider reaches this share of the model: past it, everything that changed would read as unchanged. */
export const MAX_TOLERANCE_SHARE = 0.02;
const SLIDER_STEPS = 200;

interface ModelDifferencesControlsProps {
  /** The tolerance, as a share of the model's size. */
  toleranceShare: number;
  onToleranceShare: (share: number) => void;
  modelSize: number;
  regionCount: number;
  currentRegion: number | null;
  onStep: (direction: 1 | -1) => void;
}

export function ModelDifferencesControls({ toleranceShare, onToleranceShare, modelSize, regionCount, currentRegion, onStep }: ModelDifferencesControlsProps) {
  return (
    <>
      <Pill>
        <PillLabel tip="Ignore vertices that moved less than this (a re-export's rounding, a smoothing pass)">Tolerance</PillLabel>
        <input
          className={styles.slider}
          type="range"
          min={0}
          max={SLIDER_STEPS}
          step={1}
          value={Math.round((toleranceShare / MAX_TOLERANCE_SHARE) * SLIDER_STEPS)}
          aria-label="Difference tolerance"
          onChange={(event) => onToleranceShare((Number(event.target.value) / SLIDER_STEPS) * MAX_TOLERANCE_SHARE)}
        />
        <PillValue className={styles.readout}>{formatLength(toleranceShare * modelSize)}</PillValue>
      </Pill>
      {regionCount > 0 && (
        <Pill row={1} className={styles.regionNav}>
          <PillButton icon={<ChevronLeft size={14} />} label="Previous changed region" onClick={() => onStep(-1)} />
          <PillValue className={styles.regionCount}>{regionCounter(regionCount, currentRegion)}</PillValue>
          <PillButton icon={<ChevronRight size={14} />} label="Next changed region" onClick={() => onStep(1)} />
        </Pill>
      )}
    </>
  );
}
