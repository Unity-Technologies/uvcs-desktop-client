import { Search } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import styles from './Field.module.css';

interface SearchFieldProps extends Pick<InputHTMLAttributes<HTMLInputElement>, 'aria-controls' | 'aria-activedescendant' | 'aria-label'> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Pixels, or any CSS width such as `100%`. */
  width?: number | string;
  /** Keys the field doesn't handle, e.g. ↓ to move into the list it filters. */
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, placeholder = 'Filter', autoFocus, width = 220, onKeyDown, ...aria },
  ref,
) {
  return (
    <div className={styles.search} style={{ width }}>
      <Search size={13} className={styles.searchIcon} />
      <input
        ref={ref}
        className={styles.input}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        spellCheck={false}
        {...aria}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.stopPropagation();
            onChange('');
          } else {
            onKeyDown?.(event);
          }
        }}
      />
    </div>
  );
});
