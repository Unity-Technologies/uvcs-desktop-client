// What a version of a 3D model in a binary conflict is, on its card: a still of it, and what that side changed since
// the base in the model diff's words (`modelChanges`), risks first, so "keep yours" or "keep incoming" is a choice
// made seeing what each loses. The views beside the cards show each side against the base in full.

import { TriangleAlert } from 'lucide-react';
import { useMemo, useRef } from 'react';
import type { FileContent } from '@shared/domain/content';
import { changeRows } from '../../diff/viewer/model/modelChangeWords';
import { modelChanges } from '../../diff/viewer/model/modelChanges';
import { modelThumbnail } from '../../diff/viewer/model/modelThumbnail';
import { useModelPalette } from '../../diff/viewer/model/useModelPalette';
import { useReadModel } from '../../diff/viewer/model/useReadModel';
import { Spinner } from '../../../ui/Spinner';
import styles from './ModelVersionPreview.module.css';

/** The card's preview area is about this size: the still is drawn at it. */
const THUMBNAIL = { width: 360, height: 180 };
/** The changes a card lists before "and N more": the views show them all. */
const SHOWN_CHANGES = 3;

export function ModelVersionThumbnail({ content, title }: { content: FileContent; title: string }) {
  const read = useReadModel(content.model);
  const holder = useRef<HTMLDivElement>(null);
  const palette = useModelPalette(holder);
  const still = useMemo(
    () => (read.status === 'ready' && palette ? modelThumbnail(read.model, read.summary, palette, THUMBNAIL.width, THUMBNAIL.height) : null),
    [read, palette],
  );
  return (
    <div ref={holder} className={styles.thumbnail}>
      {still ? <img src={still} alt={title} className={styles.still} /> : read.status === 'loading' && <Spinner size={16} />}
    </div>
  );
}

export function ModelSinceBase({ base, content }: { base: FileContent; content: FileContent }) {
  const before = useReadModel(base.model);
  const after = useReadModel(content.model);
  const rows = useMemo(() => (before.status === 'ready' && after.status === 'ready' ? changeRows(modelChanges(before.summary, after.summary)) : null), [before, after]);
  if (!base.model) return <p className={styles.note}>Added on this side</p>;
  if (!rows) return null;
  if (rows.length === 0) return <p className={styles.note}>Nothing Unity imports changed since the base</p>;
  return (
    <ul className={styles.changes} aria-label="Changed since the base">
      {rows.slice(0, SHOWN_CHANGES).map((row) => (
        <li key={row.id} data-tone={row.tone}>
          {row.tone === 'risk' ? <TriangleAlert size={12} /> : <span className={styles.dot} />}
          <span>{row.title}</span>
        </li>
      ))}
      {rows.length > SHOWN_CHANGES && <li className={styles.more}>and {rows.length - SHOWN_CHANGES} more</li>}
    </ul>
  );
}
