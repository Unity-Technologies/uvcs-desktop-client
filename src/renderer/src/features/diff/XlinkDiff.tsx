import { ArrowRight } from 'lucide-react';
import { Fragment } from 'react';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { ItemPathRow } from '../../components/ItemPathRow';
import { DetailsEmpty, DetailsSection, DetailsSkeleton } from '../../ui/DetailsSection';
import { diffEntryStatus } from './diffEntrySources';
import { useXlinkSides } from './useXlinkSides';
import { DiffFileTitle } from './viewer/DiffFileTitle';
import { DiffViewerFrame } from './viewer/DiffViewerFrame';
import { xlinkDiffView } from './xlinkDiffView';
import styles from './XlinkDiff.module.css';

interface XlinkDiffProps {
  workspacePath: string;
  target: DiffTarget;
  xlink: DiffEntry;
  /** The diff's files, of which the ones under the xlink are listed. */
  entries: readonly DiffEntry[];
  /** Selects one of those files in the diff's list. */
  onOpen: (entry: DiffEntry) => void;
}

/** A changed xlink of a diff: which changeset of which repository it points to on each side, and the files changed under it. */
export function XlinkDiff({ workspacePath, target, xlink, entries, onOpen }: XlinkDiffProps) {
  const sides = useXlinkSides(workspacePath, target, xlink);
  const view = xlinkDiffView(target, xlink, sides.data, entries);

  return (
    <DiffViewerFrame title={<DiffFileTitle status={diffEntryStatus(xlink)} path={xlink.path} oldPath={xlink.oldPath} />}>
      <div className={styles.body}>
        <DetailsSection title={view.kind}>
          {sides.error ? (
            <DetailsEmpty>{`Couldn't read where it points: ${sides.error.message}`}</DetailsEmpty>
          ) : !view.target ? (
            <DetailsSkeleton rows={2} />
          ) : (
            <div className={styles.target}>
              {view.target.repository && (
                <p className={styles.repository}>
                  Points to <span className={styles.name}>{view.target.repository}</span>
                </p>
              )}
              {view.target.sides.length > 0 && (
                <div className={styles.sides}>
                  {view.target.sides.map((side, index) => (
                    <Fragment key={side.label}>
                      {index > 0 && <ArrowRight size={14} className={styles.arrow} aria-label="then" />}
                      <div className={styles.side}>
                        <span className={styles.label}>{side.label}</span>
                        <span className={`${styles.changeset} mono selectable`}>{side.changeset}</span>
                        {side.repository && <span className={styles.label}>{side.repository}</span>}
                      </div>
                    </Fragment>
                  ))}
                </div>
              )}
              {view.target.note && <p className={styles.note}>{view.target.note}</p>}
            </div>
          )}
        </DetailsSection>
        <DetailsSection title={view.filesTitle}>
          {view.files.length === 0 ? (
            <DetailsEmpty>None in this diff.</DetailsEmpty>
          ) : (
            <ul className={styles.files}>
              {view.files.map((file) => (
                <li key={file.path}>
                  <button type="button" className={styles.file} onClick={() => onOpen(file)}>
                    <ItemPathRow path={file.path} itemType={file.itemType} oldPath={file.oldPath} status={diffEntryStatus(file)} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DetailsSection>
      </div>
    </DiffViewerFrame>
  );
}
