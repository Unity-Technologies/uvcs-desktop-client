import { changedLabel, HIGH_DYNAMIC_RANGE_TIP, sideLabel, type DiffStats } from './imageInfo';
import type { DecodedImage } from './useDecodedImage';
import styles from './ImageInfoStrip.module.css';

interface ImageSide {
  image: DecodedImage;
  bytes: number;
}

interface ImageInfoStripProps {
  old: ImageSide | null;
  new: ImageSide | null;
  /** How much differs, while the Differences mode shows. */
  stats: DiffStats | null;
  tolerance: number;
}

/** Narrates the change, bottom left: dimensions and size per side, then how much differs. */
export function ImageInfoStrip({ old, new: next, stats, tolerance }: ImageInfoStripProps) {
  const changed = stats && changedLabel(stats, tolerance);
  return (
    <div className={styles.strip}>
      {old && <SideLabel side="old" {...old} />}
      {old && next && <span className={styles.arrow}>→</span>}
      {next && <SideLabel side="new" {...next} />}
      {changed && <span className={styles.stat}>{changed}</span>}
    </div>
  );
}

/** One version's size, and "HDR" for a high dynamic range image, its tooltip saying it shows clamped. */
function SideLabel({ side, image, bytes }: ImageSide & { side: 'old' | 'new' }) {
  return (
    <span className={styles.side} data-side={side}>
      {sideLabel(image, bytes)}
      {image.highDynamicRange && (
        <>
          {' · '}
          <span className={styles.tag} data-tip={HIGH_DYNAMIC_RANGE_TIP}>
            HDR
          </span>
        </>
      )}
    </span>
  );
}
