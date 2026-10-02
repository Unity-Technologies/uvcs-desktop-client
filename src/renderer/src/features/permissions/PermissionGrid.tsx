import { forwardRef, useCallback, useId, type KeyboardEvent } from 'react';
import type { PermissionName } from '@shared/domain/permissions';
import type { OwnState, PermissionResolution } from './aclResolution';
import type { PermissionGroup } from './permissionCatalog';
import { gridKeyAction } from './permissionGridKeys';
import type { OverrideKind } from './permissionsDraft';
import { PermissionRow } from './PermissionRow';
import styles from './PermissionGrid.module.css';

interface PermissionGridProps {
  /** The member's permissions under their groups, as the filter leaves them. */
  groups: PermissionGroup[];
  resolutions: ReadonlyMap<PermissionName, PermissionResolution>;
  changed: ReadonlySet<PermissionName>;
  hasAbove: boolean;
  active: PermissionName | undefined;
  onActivate: (permission: PermissionName) => void;
  onSet: (permission: PermissionName, state: OwnState) => void;
  onOverride: (permission: PermissionName, kind: OverrideKind, on: boolean) => void;
}

/**
 * The permissions of the member picked, one Tab stop for all: ↑ ↓ move, ← → and A, D, I set (`gridKeyAction`), the
 * active row showing its details. Rows are buttons only for the mouse.
 */
export const PermissionGrid = forwardRef<HTMLDivElement, PermissionGridProps>(function PermissionGrid(
  { groups, resolutions, changed, hasAbove, active, onActivate, onSet, onOverride },
  ref,
) {
  const gridId = useId();
  const rows = groups.flatMap((group) => group.permissions);
  const rowId = useCallback((permission: PermissionName) => `${gridId}-${permission}`, [gridId]);
  const activeIndex = active ? rows.indexOf(active) : -1;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // The details' own controls (a checkbox, a button) keep their keys but for the grid's.
    const action = gridKeyAction(event, Math.max(0, activeIndex), rows.length, active && resolutions.get(active)?.own);
    if (!action) return;
    event.preventDefault();
    if (action.kind === 'set') {
      if (active) onSet(active, action.state);
      return;
    }
    const next = rows[action.index]!;
    onActivate(next);
    requestAnimationFrame(() => document.getElementById(rowId(next))?.scrollIntoView({ block: 'nearest' }));
  };

  return (
    <div
      ref={ref}
      role="grid"
      aria-label="Permissions"
      aria-activedescendant={active && activeIndex >= 0 ? rowId(active) : undefined}
      tabIndex={0}
      className={styles.grid}
      onKeyDown={onKeyDown}
      onFocus={() => !active && rows[0] && onActivate(rows[0])}
    >
      {groups.map((group) => (
        <div key={group.id} role="rowgroup" aria-label={group.label} className={styles.group}>
          <div className={styles.groupTitle} aria-hidden>
            {group.label}
          </div>
          {group.permissions.map((permission) => (
            <PermissionRow
              key={permission}
              id={rowId(permission)}
              permission={permission}
              resolution={resolutions.get(permission)!}
              active={permission === active}
              changed={changed.has(permission)}
              hasAbove={hasAbove}
              onActivate={onActivate}
              onSet={onSet}
              onOverride={onOverride}
            />
          ))}
        </div>
      ))}
    </div>
  );
});
