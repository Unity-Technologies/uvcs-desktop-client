import type { OwnState } from './aclResolution';
import { OWN_STATES } from './permissionGridKeys';
import { STATE_LABELS } from './permissionWords';
import styles from './PermissionGrid.module.css';

interface PermissionGridHeaderProps {
  /** "all", or "shown" while a filter hides some. */
  scope: 'all' | 'shown';
  hasOverrides: boolean;
  onSetAll: (state: OwnState) => void;
}

/**
 * The grid's column titles, on the grid's own columns so each stays over what it names: the bulk choices sit over
 * the choice they set in every row, in the same order (`OWN_STATES`). It stays in view while the rows scroll.
 */
export function PermissionGridHeader({ scope, hasOverrides, onSetAll }: PermissionGridHeaderProps) {
  return (
    <div role="row" className={styles.headerRow} data-grid-header>
      <span role="columnheader" className={styles.columnTitle}>
        Permission
      </span>
      <span role="columnheader" className={styles.columnTitle}>
        Result
      </span>
      <span role="columnheader" className={styles.bulkStates} aria-label="Set every permission shown">
        {OWN_STATES.map((state) => (
          <button key={state} type="button" className={styles.bulkState} data-tip={`${STATE_LABELS[state]} every permission ${scope === 'all' ? 'listed' : 'shown'}`} onClick={() => onSetAll(state)}>
            {STATE_LABELS[state]} {scope}
          </button>
        ))}
      </span>
      {hasOverrides && <span role="columnheader" aria-label="Overrides" />}
    </div>
  );
}
