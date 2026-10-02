import { Ban, CircleCheck, CircleMinus, Info, MoreHorizontal } from 'lucide-react';
import { memo } from 'react';
import type { PermissionName } from '@shared/domain/permissions';
import { hotkey } from '../../lib/shortcutRegistry';
import { Highlight } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import type { OwnState, PermissionResolution } from './aclResolution';
import { OWN_STATES } from './permissionGridKeys';
import { PERMISSION_INFO } from './permissionCatalog';
import { overrideMenuEntries } from './permissionOverrideMenu';
import type { OverrideKind } from './permissionsDraft';
import { effectiveLabel, effectiveSentence, permissionHelp, STATE_LABELS, STATE_TIPS } from './permissionWords';
import { sourceLabel } from './permissionTargets';
import styles from './PermissionGrid.module.css';

const STATE_KEYS = { inherit: 'permissionInherit', allow: 'permissionAllow', deny: 'permissionDeny' } as const;

interface PermissionRowProps {
  id: string;
  permission: PermissionName;
  resolution: PermissionResolution;
  active: boolean;
  /** The choice saved on the server, when the draft picks another (`savedChoices`). */
  savedChoice: OwnState | undefined;
  /** There are lists above to inherit from (not on the server), so the overrides apply. */
  hasAbove: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (permission: PermissionName, open: boolean) => void;
  onActivate: (permission: PermissionName) => void;
  onSet: (permission: PermissionName, state: OwnState) => void;
  onOverride: (permission: PermissionName, kind: OverrideKind, on: boolean) => void;
}

/**
 * One permission of the member picked: its name, what the entry says (inherit, allow, deny) and the result. Its help
 * is the tooltip of an info mark and its overrides a menu, both shown on the hovered or active row: a row never changes
 * height, so a click lands where it was aimed. An edited choice keeps the saved one outlined beside it.
 */
export const PermissionRow = memo(function PermissionRow(props: PermissionRowProps) {
  const { id, permission, resolution, active, savedChoice, hasAbove, menuOpen, onMenuOpenChange, onActivate, onSet, onOverride } = props;
  const info = PERMISSION_INFO[permission];
  return (
    <div
      id={id}
      role="row"
      aria-selected={active}
      aria-label={`${info.label}: ${STATE_LABELS[resolution.own].toLowerCase()}, ${effectiveSentence(resolution).toLowerCase()}`}
      aria-description={info.description}
      className={styles.row}
      data-active={active}
      data-menu-open={menuOpen}
      onMouseDown={() => onActivate(permission)}
    >
      <div className={styles.line}>
        <span role="gridcell" className={styles.name}>
          <span className={styles.label}>
            <Highlight text={info.label} />
          </span>
          <span className={styles.cmName}>
            <Highlight text={permission} />
          </span>
          <span className={styles.help} data-tip={permissionHelp(permission, resolution, hasAbove)} aria-hidden>
            <Info size={13} />
          </span>
        </span>
        <span role="gridcell" className={styles.effective} data-effective={resolution.effective} data-tip={effectiveSentence(resolution)}>
          <EffectiveIcon effective={resolution.effective} />
          <span className={styles.effectiveLabel}>{effectiveLabel(resolution)}</span>
          {resolution.source && <span className={styles.source}>{sourceLabel(resolution.source)}</span>}
        </span>
        <span role="gridcell" className={styles.states} aria-label="Inherit, allow or deny">
          {OWN_STATES.map((state) => (
            <button
              key={state}
              type="button"
              tabIndex={-1}
              className={styles.state}
              data-state={state}
              data-saved={state === savedChoice}
              aria-pressed={resolution.own === state}
              data-tip={state === savedChoice ? 'What is saved now: pick it to undo the edit' : STATE_TIPS[state]}
              data-tip-shortcut={hotkey(STATE_KEYS[state])}
              onClick={() => onSet(permission, state)}
            >
              {STATE_LABELS[state]}
            </button>
          ))}
        </span>
        {hasAbove && (
          <span role="gridcell" className={styles.more}>
            <ActionDropdownMenu
              entries={overrideMenuEntries(resolution, (kind, on) => onOverride(permission, kind, on))}
              open={menuOpen}
              onOpenChange={(open) => onMenuOpenChange(permission, open)}
            >
              <IconButton size="small" tabIndex={-1} icon={<MoreHorizontal size={14} />} label="Overrides" shortcut={hotkey('permissionMenu')} />
            </ActionDropdownMenu>
          </span>
        )}
      </div>
    </div>
  );
});

function EffectiveIcon({ effective }: { effective: PermissionResolution['effective'] }) {
  if (effective === 'allowed') return <CircleCheck size={14} className={styles.effectiveIcon} />;
  if (effective === 'denied') return <Ban size={14} className={styles.effectiveIcon} />;
  return <CircleMinus size={14} className={styles.effectiveIcon} />;
}
