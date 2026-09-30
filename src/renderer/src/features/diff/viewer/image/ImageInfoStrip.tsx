import { changedLabel, sideLabel, type DiffStats } from './imageInfo';
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
      {old && (
        <span className={styles.side} data-side="old">
          {sideLabel(old.image, old.bytes)}
        </span>
      )}
      {old && next && <span className={styles.arrow}>→</span>}
      {next && (
        <span className={styles.side} data-side="new">
          {sideLabel(next.image, next.bytes)}
        </span>
      )}
      {changed && <span className={styles.stat}>{changed}</span>}
    </div>
  );
}
