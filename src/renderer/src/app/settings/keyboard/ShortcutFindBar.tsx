import { Keyboard } from 'lucide-react';
import { TAKES_ESCAPE } from '../../../lib/modalDialog';
import { formatShortcut } from '../../../lib/shortcuts';
import { IconButton } from '../../../ui/IconButton';
import { SearchField } from '../../../ui/SearchField';
import { findTakesEscape } from './keyboardRows';
import type { ShortcutFind } from './useShortcutFind';
import styles from './ShortcutFindBar.module.css';

/** The field that finds shortcuts by name, and the button that has it find them by the keys pressed instead. */
export function ShortcutFindBar({ find, autoFocus }: { find: ShortcutFind; autoFocus?: boolean }) {
  const placeholder = find.findByKeys ? 'Press keys to find them' : 'Find a shortcut';
  return (
    <div className={styles.find} {...(findTakesEscape(find.filter) && TAKES_ESCAPE)}>
      <SearchField
        ref={find.fieldRef}
        value={find.findByKeys ? (find.keyFound ? formatShortcut(find.keyFound).join('') : '') : find.text}
        onChange={(value) => (find.findByKeys ? find.clearKey() : find.setText(value))}
        onKeyDown={find.onFieldKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        width="100%"
      />
      <IconButton icon={<Keyboard size={14} />} label="Find by keys" aria-pressed={find.findByKeys} onClick={find.toggleFindByKeys} />
    </div>
  );
}
