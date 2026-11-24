import type { MouseEvent } from 'react';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { MenuChip, ToggleChip } from '../../ui/ToggleChip';
import type { PaletteScope } from './paletteScope';
import { clickedChip, moreChipLabel, type ScopeChip, type ScopeChips } from './scopeChips';
import styles from './CommandPalette.module.css';

interface ScopeChipRowProps {
  chips: ScopeChips;
  scope: PaletteScope;
  onPick: (chip: ScopeChip) => void;
  /** Gives the focus back to the search once More's menu closes. */
  onMenuClosed: () => void;
}

/**
 * The sections the palette can narrow to (`scopeChipsFor`), the one searched highlighted; each shows its prefix. They
 * are the mouse's way: the keys are the prefixes typed, or ⌥⌘← ⌥⌘→ (`scopeStepOf`), as Tab is the palette's.
 */
export function ScopeChipRow({ chips, scope, onPick, onMenuClosed }: ScopeChipRowProps) {
  const more = moreChipLabel(chips.more, scope);
  const moreEntries = chips.more.map((chip) => ({ id: chip.scope, label: chip.label, detail: chip.prefix, checked: chip.scope === scope, run: () => onPick(chip) }));
  return (
    <div className={styles.scopes} role="group" aria-label="Search in">
      {chips.row.map((chip) => (
        <ToggleChip key={chip.scope} size="small" pressed={chip.scope === scope} onChange={() => onPick(clickedChip(chips, chip, scope))} onMouseDown={keepFocusInSearch}>
          {chip.label}
          {chip.prefix && <span className={styles.chipPrefix}>{chip.prefix}</span>}
        </ToggleChip>
      ))}
      {chips.more.length > 0 && (
        <ActionDropdownMenu
          align="start"
          entries={moreEntries}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onMenuClosed();
          }}
        >
          <MenuChip active={more.active} size="small">
            {more.label}
          </MenuChip>
        </ActionDropdownMenu>
      )}
    </div>
  );
}

/** A chip is clicked without taking the caret from the search, where the user goes on typing. */
function keepFocusInSearch(event: MouseEvent): void {
  event.preventDefault();
}
