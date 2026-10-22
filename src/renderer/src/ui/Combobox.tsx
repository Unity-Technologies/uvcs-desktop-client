import * as Popover from '@radix-ui/react-popover';
import { ChevronDown } from 'lucide-react';
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { classNames } from '../lib/classNames';
import { ComboboxList } from './ComboboxList';
import { afterArrowClick, afterKey, afterTyping, COMBOBOX_CLOSED, comboboxListed, comboboxShown } from './comboboxState';
import fieldStyles from './Field.module.css';
import { FieldFrame, type FieldChrome } from './TextField';
import styles from './Combobox.module.css';

interface ComboboxProps extends FieldChrome {
  value: string;
  onChange: (value: string) => void;
  /** Memoized by the caller: a server can hold thousands, and a new array filters them again. */
  options: readonly string[];
  /** What the options are, for screen readers: "Repositories". */
  optionsLabel: string;
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
}

/**
 * A text field that suggests options: type any value, or pick one from the list its arrow (or ↓) opens, which lists
 * every option whatever the field holds; typing narrows it. Its state and keys: `comboboxState`; its list:
 * `ComboboxList`.
 */
export function Combobox({ label, hint, error, value, onChange, options, optionsLabel, placeholder, readOnly = false, autoFocus }: ComboboxProps) {
  const id = useId();
  const listboxId = `${id}-options`;
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState(COMBOBOX_CLOSED);
  // A hover or a highlight moved doesn't filter the options again.
  const shown = useMemo(() => comboboxShown(state.showAll, options, value), [state.showAll, options, value]);
  const listed = comboboxListed(state, shown.length, readOnly);

  const pick = (option: string): void => {
    onChange(option);
    setState(COMBOBOX_CLOSED);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const result = afterKey(
      state,
      { key: event.key, withShortcutModifier: event.metaKey || event.ctrlKey, composing: event.nativeEvent.isComposing },
      options,
      value,
      readOnly,
    );
    if (result.handled) event.preventDefault();
    if (result.picked !== undefined) pick(result.picked);
    else setState(result.state);
  };

  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <Popover.Root open={listed} onOpenChange={(open) => !open && setState(COMBOBOX_CLOSED)}>
        <Popover.Anchor asChild>
          <div ref={anchorRef} className={styles.box}>
            <input
              ref={inputRef}
              id={id}
              className={classNames(fieldStyles.input, styles.input)}
              value={value}
              placeholder={placeholder}
              readOnly={readOnly}
              autoFocus={autoFocus}
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded={listed}
              aria-autocomplete="list"
              aria-controls={listed ? listboxId : undefined}
              aria-activedescendant={listed && state.active >= 0 ? `${listboxId}-${state.active}` : undefined}
              onChange={(event) => {
                onChange(event.target.value);
                setState(afterTyping());
              }}
              onKeyDown={onKeyDown}
              onBlur={() => setState(COMBOBOX_CLOSED)}
            />
            {!readOnly && (
              <button
                type="button"
                className={styles.arrow}
                tabIndex={-1}
                aria-label={`Show ${optionsLabel.toLowerCase()}`}
                // Keeps the focus in the field, so the list it opens belongs to the field.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  inputRef.current?.focus();
                  setState(afterArrowClick(listed, options, value));
                }}
              >
                <ChevronDown size={14} />
              </button>
            )}
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            // A list belonging to the field, not a dialog of its own (Radix's default role).
            role="presentation"
            className={styles.popover}
            align="start"
            sideOffset={4}
            collisionPadding={8}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            // The field keeps the focus, and with it the keys, wherever the list is pressed: a row, its padding, its scrollbar.
            onMouseDownCapture={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              // A press on the field or its arrow is the combobox's own, not one away from the list.
              if (event.target instanceof Node && anchorRef.current?.contains(event.target)) event.preventDefault();
            }}
          >
            <ComboboxList
              id={listboxId}
              label={optionsLabel}
              options={shown}
              active={state.active}
              onHighlight={(index) => setState({ ...state, active: index })}
              onPick={pick}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </FieldFrame>
  );
}
