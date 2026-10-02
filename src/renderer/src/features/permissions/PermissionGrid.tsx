import { forwardRef, useCallback, useId, useState, type KeyboardEvent } from 'react';
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
  /** The saved choice of each permission the draft picks another for (`savedChoices`). */
  savedChoices: ReadonlyMap<PermissionName, OwnState>;
  /** There are lists above to inherit from (not on the server), so the overrides apply. */
  hasAbove: boolean;
  active: PermissionName | undefined;
  onActivate: (permission: PermissionName) => void;
  onSet: (permission: PermissionName, state: OwnState) => void;
  onOverride: (permission: PermissionName, kind: OverrideKind, on: boolean) => void;
}

/**
 * The permissions of the member picked, one Tab stop for all: ↑ ↓ move, ← → and A, D, I set (`gridKeyAction`), the
 * Shift+F10 opening the active row's overrides menu. Rows are buttons only for the mouse.
 */
export const PermissionGrid = forwardRef<HTMLDivElement, PermissionGridProps>(function PermissionGrid(
  { groups, resolutions, savedChoices, hasAbove, active, onActivate, onSet, onOverride },
  ref,
) {
  const gridId = useId();
  const rows = groups.flatMap((group) => group.permissions);
  const rowId = useCallback((permission: PermissionName) => `${gridId}-${permission}`, [gridId]);
  const activeIndex = active ? rows.indexOf(active) : -1;
  const [menuFor, setMenuFor] = useState<PermissionName>();
  const onMenuOpenChange = useCallback(
    (permission: PermissionName, open: boolean) => {
      setMenuFor(open ? permission : undefined);
      // In a dialog a closing menu leaves focus alone (`focusAfterMenu`): the grid takes it back, its keys working on.
      if (!open) requestAnimationFrame(() => document.getElementById(rowId(permission))?.closest<HTMLElement>('[role="grid"]')?.focus());
    },
    [rowId],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const action = gridKeyAction(event, Math.max(0, activeIndex), rows.length, active && resolutions.get(active)?.own);
    if (!action) return;
    event.preventDefault();
    if (action.kind === 'menu') {
      if (active && hasAbove) setMenuFor(active);
      return;
    }
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
      {/* One set of columns for every row (subgrid): the result column as wide as the widest result shown, aligned. */}
      <div className={styles.columns} data-overrides={hasAbove}>
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
                savedChoice={savedChoices.get(permission)}
                hasAbove={hasAbove}
                menuOpen={menuFor === permission}
                onMenuOpenChange={onMenuOpenChange}
                onActivate={onActivate}
                onSet={onSet}
                onOverride={onOverride}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});
