import { useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { isMac } from '../../../lib/platform';
import { formatShortcut } from '../../../lib/shortcuts';
import { findKey, type KeyboardFilter } from './keyboardRows';

/** Finding shortcuts by the words of their names, or by pressing their keys (Find by keys): the state and its keys. */
export interface ShortcutFind {
  filter: KeyboardFilter;
  /** The words to highlight in the rows: none while finding by keys. */
  highlight: string;
  findByKeys: boolean;
  /** What the field shows: the words, or the keys pressed as the screen writes them. */
  fieldValue: string;
  /** The field's placeholder, which is also its name. */
  placeholder: string;
  fieldRef: RefObject<HTMLInputElement | null>;
  /** The field's text changed: new words, or, while finding by keys, the keys cleared. */
  onFieldChange: (value: string) => void;
  toggleFindByKeys: () => void;
  onFieldKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

/** Settings ▸ Keyboard's find and the shortcuts sheet's: the same words, keys and Esc (`findKey`). */
export function useShortcutFind(): ShortcutFind {
  const [text, setText] = useState('');
  const [findByKeys, setFindByKeys] = useState(false);
  const [keyFound, setKeyFound] = useState<string | null>(null);
  const fieldRef = useRef<HTMLInputElement>(null);

  const onFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (!findByKeys) return;
    const pressed = findKey(event.nativeEvent, keyFound, isMac);
    if (pressed.action === 'leave') return;
    event.preventDefault();
    if (pressed.action === 'record') setKeyFound(pressed.key);
    else if (pressed.action === 'clear') setKeyFound(null);
    else if (pressed.action === 'findByName') setFindByKeys(false);
  };

  return {
    filter: findByKeys ? { by: 'key', key: keyFound } : { by: 'words', text },
    highlight: findByKeys ? '' : text,
    findByKeys,
    fieldValue: findByKeys ? (keyFound ? formatShortcut(keyFound).join('') : '') : text,
    placeholder: findByKeys ? 'Press keys to find them' : 'Find a shortcut',
    fieldRef,
    onFieldChange: (value) => (findByKeys ? setKeyFound(null) : setText(value)),
    toggleFindByKeys: () => {
      setFindByKeys(!findByKeys);
      setKeyFound(null);
      fieldRef.current?.focus();
    },
    onFieldKeyDown,
  };
}
