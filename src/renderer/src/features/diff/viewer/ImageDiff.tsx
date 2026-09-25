import { useState } from 'react';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import styles from './ImageDiff.module.css';

type ImageDiffMode = 'sideBySide' | 'swipe' | 'onion';

interface ImageDiffProps {
  originalUrl?: string;
  modifiedUrl?: string;
}

export function ImageDiff({ originalUrl, modifiedUrl }: ImageDiffProps) {
  const [mode, setMode] = useState<ImageDiffMode>('sideBySide');
  const [amount, setAmount] = useState(50);
  const comparable = Boolean(originalUrl && modifiedUrl);

  return (
    <div className={styles.imageDiff}>
      {comparable && (
        <div className={styles.toolbar}>
          <SegmentedControl<ImageDiffMode>
            value={mode}
            onChange={setMode}
            segments={[
              { value: 'sideBySide', label: 'Side by side' },
              { value: 'swipe', label: 'Swipe' },
              { value: 'onion', label: 'Onion skin' },
            ]}
          />
          {mode !== 'sideBySide' && (
            <input className={styles.slider} type="range" min={0} max={100} value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
          )}
        </div>
      )}

      {mode === 'sideBySide' || !comparable ? (
        <div className={styles.sideBySide}>
          <ImageFrame label="Before" url={originalUrl} />
          <ImageFrame label="After" url={modifiedUrl} />
        </div>
      ) : (
        <div className={styles.stage}>
          <div className={styles.stack}>
            <img src={originalUrl} alt="Before" className={styles.image} />
            <img
              src={modifiedUrl}
              alt="After"
              className={styles.image}
              style={mode === 'swipe' ? { clipPath: `inset(0 0 0 ${amount}%)` } : { opacity: amount / 100 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ImageFrame({ label, url }: { label: string; url?: string }) {
  return (
    <figure className={styles.frame}>
      <figcaption className={styles.caption}>{label}</figcaption>
      <div className={styles.checkerboard}>{url ? <img src={url} alt={label} className={styles.image} /> : <span className={styles.none}>No image</span>}</div>
    </figure>
  );
}
