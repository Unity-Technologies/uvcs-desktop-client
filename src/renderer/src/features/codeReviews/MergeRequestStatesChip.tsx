import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { GitPullRequest } from 'lucide-react';
import { MERGE_REQUEST_STATES } from '@shared/domain/codeReview';
import { focusAfterMenu } from '../../ui/menu/focusAfterMenu';
import { keepMenuOpen, MenuMark } from '../../ui/menu/MenuChoice';
import menuStyles from '../../ui/menu/Menu.module.css';
import { MenuChip } from '../../ui/ToggleChip';
import { MERGE_REQUEST_STATE_ICONS } from './mergeRequestState';
import { EVERY_STATE, isOnlyState, statesChipLabel, toggledState, type MergeRequestStates } from './mergeRequestStatesFilter';
import styles from './MergeRequestStatesChip.module.css';

interface MergeRequestStatesChipProps {
  states: MergeRequestStates;
  onChange: (states: MergeRequestStates) => void;
  /** Highlights the chip when the states narrow the list: anything but where it rests. */
  active: boolean;
}

/**
 * The State chip of Merge requests: any mix of Draft, Open, Merged and Closed, each ticked with the menu still open so
 * the list behind it shows each change. The chip shows the states ticked by their glyphs, in their colors, and names
 * them ("Draft or open"); the last one ticked can't be unticked (`toggledState`).
 */
export function MergeRequestStatesChip({ states, onChange, active }: MergeRequestStatesChipProps) {
  const label = statesChipLabel(states);
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <MenuChip icon={<StateGlyphs states={states} />} active={active} aria-label={`State: ${label}`}>
          {label}
        </MenuChip>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={menuStyles.content}
          align="start"
          sideOffset={4}
          onCloseAutoFocus={(event) => focusAfterMenu(event)}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {MERGE_REQUEST_STATES.map((state) => {
            const StateIcon = MERGE_REQUEST_STATE_ICONS[state];
            const ticked = states.includes(state);
            return (
              <DropdownMenu.CheckboxItem
                key={state}
                className={menuStyles.item}
                checked={ticked}
                disabled={isOnlyState(states, state)}
                onCheckedChange={() => onChange(toggledState(states, state))}
                onSelect={keepMenuOpen}
              >
                <span className={`${menuStyles.icon} ${styles.stateIcon}`} data-state={state}>
                  <StateIcon size={14} />
                </span>
                <span className={menuStyles.label}>{state}</span>
                <MenuMark shown={ticked} />
              </DropdownMenu.CheckboxItem>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** The glyphs of the states ticked, side by side in their colors; the plain merge request glyph with every state. */
function StateGlyphs({ states }: { states: MergeRequestStates }) {
  if (states.length === EVERY_STATE.length) return <GitPullRequest size={13} />;
  return (
    <span className={styles.glyphs} aria-hidden>
      {states.map((state) => {
        const StateIcon = MERGE_REQUEST_STATE_ICONS[state];
        return (
          <span key={state} className={styles.stateIcon} data-state={state}>
            <StateIcon size={13} />
          </span>
        );
      })}
    </span>
  );
}
