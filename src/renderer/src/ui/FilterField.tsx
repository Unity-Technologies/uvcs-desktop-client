import { useEffect, useRef } from 'react';
import { focusMain, isKeyboardTaken } from '../lib/mainFocus';
import { windowShortcutMayRun } from '../lib/modalDialog';
import { hotkey, hotkeys } from '../lib/shortcutRegistry';
import { matchesShortcut } from '../lib/shortcuts';
import { SearchField } from './SearchField';

interface FilterFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** "Filter branches": the rows it filters. */
  placeholder: string;
  /** Pixels, or any CSS width. */
  width?: number | string;
}

/** Every filter bar's text field is this wide, so the chips after it line up from view to view. */
export const FILTER_FIELD_WIDTH = 240;

/**
 * The text filter of a view's filter bar, first in it. ⌘F (and / from anywhere but a text field) goes to it while it
 * shows; ↓ goes on to the list, and Esc empties it, then goes back to the list.
 */
export function FilterField({ value, onChange, placeholder, width = FILTER_FIELD_WIDTH }: FilterFieldProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const input = ref.current;
      if (!input?.checkVisibility() || !windowShortcutMayRun(event)) return;
      const key = hotkeys('listFilter').find((candidate) => matchesShortcut(event, candidate));
      if (!key) return;
      // The plain key is typed wherever something takes the keys: fields, menus, popovers.
      if (key !== hotkey('listFilter') && isKeyboardTaken()) return;
      event.preventDefault();
      input.focus();
      input.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <SearchField
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      width={width}
      aria-label={placeholder}
      tip={{ text: placeholder, shortcut: hotkey('listFilter') }}
      onKeyDown={(event) => {
        if ((event.key === 'ArrowDown' || event.key === 'Escape') && focusMain(document)) event.preventDefault();
      }}
    />
  );
}
