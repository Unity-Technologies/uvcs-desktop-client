import { Keyboard } from 'lucide-react';
import { TAKES_ESCAPE } from '../../../lib/modalDialog';
import { IconButton } from '../../../ui/IconButton';
import { SearchField } from '../../../ui/SearchField';
import { findTakesEscape } from './keyboardRows';
import type { ShortcutFind } from './useShortcutFind';
import styles from './ShortcutFindBar.module.css';

/** The field that finds shortcuts by name, and the button that has it find them by the keys pressed instead. */
export function ShortcutFindBar({ find, autoFocus }: { find: ShortcutFind; autoFocus?: boolean }) {
  return (
    <div className={styles.find} {...(findTakesEscape(find.filter) && TAKES_ESCAPE)}>
      <SearchField
        ref={find.fieldRef}
        value={find.fieldValue}
        onChange={find.onFieldChange}
        onKeyDown={find.onFieldKeyDown}
        placeholder={find.placeholder}
        aria-label={find.placeholder}
        autoFocus={autoFocus}
        width="100%"
      />
      <IconButton icon={<Keyboard size={14} />} label="Find by keys" aria-pressed={find.findByKeys} onClick={find.toggleFindByKeys} />
    </div>
  );
}
