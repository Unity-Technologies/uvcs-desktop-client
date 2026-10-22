import * as Popover from '@radix-ui/react-popover';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { comboboxKeyAction, activeOnOpen, comboboxOptionsShown } from './comboboxKeys';
import fieldStyles from './Field.module.css';
import { FieldFrame, type FieldChrome } from './TextField';
import styles from './Combobox.module.css';

interface ComboboxProps extends FieldChrome {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  /** What the options are, for screen readers: "Repositories". */
  optionsLabel: string;
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
}

/**
 * A text field that suggests options: type any value, or pick one from the list its arrow (or ↓) opens, which lists
 * every option whatever the field holds; typing narrows it. Keys: `comboboxKeyAction`.
 */
export function Combobox({ label, hint, error, value, onChange, options, optionsLabel, placeholder, readOnly, autoFocus }: ComboboxProps) {
  const id = useId();
  const listboxId = `${id}-options`;
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [active, setActive] = useState(-1);
  const shown = comboboxOptionsShown(options, value, showAll);
  const listed = open && !readOnly && shown.length > 0;

  useEffect(() => {
    if (listed && active >= 0) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [listed, active]);

  const openAll = (highlighted: number): void => {
    setShowAll(true);
    setActive(highlighted);
    setOpen(true);
  };

  const pick = (index: number): void => {
    const option = shown[index];
    if (option !== undefined) onChange(option);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (readOnly) return;
    const action = comboboxKeyAction(event.key, listed, active, listed ? shown : options, value);
    if (action.kind === 'none') return;
    if (action.kind === 'close') {
      setOpen(false);
      return;
    }
    event.preventDefault();
    if (action.kind === 'open') openAll(action.active);
    else if (action.kind === 'move') setActive(action.to);
    else pick(action.index);
  };

  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <Popover.Root open={listed} onOpenChange={(next) => !next && setOpen(false)}>
        <Popover.Anchor asChild>
          <div ref={anchorRef} className={styles.box}>
            <input
              ref={inputRef}
              id={id}
              className={`${fieldStyles.input} ${styles.input}`}
              value={value}
              placeholder={placeholder}
              readOnly={readOnly}
              autoFocus={autoFocus}
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded={listed}
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={listed && active >= 0 ? `${listboxId}-${active}` : undefined}
              onChange={(event) => {
                onChange(event.target.value);
                setShowAll(false);
                setActive(-1);
                setOpen(true);
              }}
              onKeyDown={onKeyDown}
              onBlur={() => setOpen(false)}
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
                  if (listed) setOpen(false);
                  else openAll(activeOnOpen(options, value));
                }}
              >
                <ChevronDown size={14} />
              </button>
            )}
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            className={styles.popover}
            align="start"
            sideOffset={4}
            collisionPadding={8}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              // A click on the field or its arrow is the combobox's own, not a click away from the list.
              if (event.target instanceof Node && anchorRef.current?.contains(event.target)) event.preventDefault();
            }}
          >
            <div ref={listRef} id={listboxId} role="listbox" aria-label={optionsLabel} className={styles.list}>
              {shown.map((option, index) => (
                <div
                  key={option}
                  id={`${listboxId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={index === active}
                  className={styles.option}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(index)}
                >
                  {option}
                </div>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </FieldFrame>
  );
}
