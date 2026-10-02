import { Ban, CircleCheck, CircleMinus } from 'lucide-react';
import { memo } from 'react';
import type { PermissionName } from '@shared/domain/permissions';
import { hotkey } from '../../lib/shortcutRegistry';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Highlight } from '../../ui/Highlight';
import type { OwnState, PermissionResolution } from './aclResolution';
import { OWN_STATES } from './permissionGridKeys';
import { PERMISSION_INFO } from './permissionCatalog';
import type { OverrideKind } from './permissionsDraft';
import { aboveSentence, effectiveLabel, effectiveSentence, losesToDenyAbove, STATE_LABELS, STATE_TIPS } from './permissionWords';
import { sourceLabel } from './permissionTargets';
import styles from './PermissionGrid.module.css';

const STATE_KEYS = { inherit: 'permissionInherit', allow: 'permissionAllow', deny: 'permissionDeny' } as const;

interface PermissionRowProps {
  id: string;
  permission: PermissionName;
  resolution: PermissionResolution;
  active: boolean;
  changed: boolean;
  /** There are lists above to inherit from (not on the server). */
  hasAbove: boolean;
  onActivate: (permission: PermissionName) => void;
  onSet: (permission: PermissionName, state: OwnState) => void;
  onOverride: (permission: PermissionName, kind: OverrideKind, on: boolean) => void;
}

/** One permission of the member picked: its name, what the entry says (inherit, allow, deny) and the result; the active one with its details. */
export const PermissionRow = memo(function PermissionRow({ id, permission, resolution, active, changed, hasAbove, onActivate, onSet, onOverride }: PermissionRowProps) {
  const info = PERMISSION_INFO[permission];
  return (
    <div
      id={id}
      role="row"
      aria-selected={active}
      aria-label={`${info.label}: ${STATE_LABELS[resolution.own].toLowerCase()}, ${effectiveSentence(resolution).toLowerCase()}`}
      className={styles.row}
      data-active={active}
      data-changed={changed}
      onMouseDown={() => onActivate(permission)}
    >
      <div className={styles.line}>
        <span role="gridcell" className={styles.name} data-tip={info.description}>
          <span className={styles.label}>
            <Highlight text={info.label} />
          </span>
          <span className={styles.cmName}>
            <Highlight text={permission} />
          </span>
        </span>
        <span role="gridcell" className={styles.states} aria-label="Inherit, allow or deny">
          {OWN_STATES.map((state) => (
            <button
              key={state}
              type="button"
              tabIndex={-1}
              className={styles.state}
              data-state={state}
              aria-pressed={resolution.own === state}
              data-tip={STATE_TIPS[state]}
              data-tip-shortcut={hotkey(STATE_KEYS[state])}
              onClick={() => onSet(permission, state)}
            >
              {STATE_LABELS[state]}
            </button>
          ))}
        </span>
        <span role="gridcell" className={styles.effective} data-effective={resolution.effective} data-tip={effectiveSentence(resolution)}>
          <EffectiveIcon effective={resolution.effective} />
          <span className={styles.effectiveLabel}>{effectiveLabel(resolution)}</span>
          {resolution.source && <span className={styles.source}>{sourceLabel(resolution.source)}</span>}
        </span>
      </div>
      {active && (
        <div className={styles.details}>
          <p className={styles.description}>{info.description}</p>
          {hasAbove && <p className={styles.above}>{aboveSentence(resolution)}</p>}
          {losesToDenyAbove(resolution) && (
            <p className={styles.warning}>
              A deny above wins over this allow.
              <Button size="small" variant="ghost" onClick={() => onOverride(permission, 'overrideDenied', true)}>
                Allow anyway
              </Button>
            </p>
          )}
          {hasAbove && (
            <div className={styles.overrides}>
              <Checkbox
                label="Ignore allows from above"
                checked={resolution.ignoresAllowsAbove}
                onChange={(on) => onOverride(permission, 'overrideAllowed', on)}
              />
              <Checkbox
                label="Ignore denies from above"
                checked={resolution.ignoresDeniesAbove}
                onChange={(on) => onOverride(permission, 'overrideDenied', on)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
});

function EffectiveIcon({ effective }: { effective: PermissionResolution['effective'] }) {
  if (effective === 'allowed') return <CircleCheck size={14} className={styles.effectiveIcon} />;
  if (effective === 'denied') return <Ban size={14} className={styles.effectiveIcon} />;
  return <CircleMinus size={14} className={styles.effectiveIcon} />;
}
