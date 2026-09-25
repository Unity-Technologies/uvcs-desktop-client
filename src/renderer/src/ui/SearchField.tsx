import { Search } from 'lucide-react';
import { forwardRef } from 'react';
import styles from './Field.module.css';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Pixels, or any CSS width such as `100%`. */
  width?: number | string;
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, placeholder = 'Filter', autoFocus, width = 220 },
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
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.stopPropagation();
            onChange('');
          }
        }}
      />
    </div>
  );
});
