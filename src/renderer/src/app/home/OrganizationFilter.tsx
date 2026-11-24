import { SearchField } from '../../ui/SearchField';
import styles from './OrganizationFilter.module.css';

interface OrganizationFilterProps {
  value: string;
  onChange: (value: string) => void;
  /** Nothing the sidebar lists holds the text. */
  noMatches: boolean;
}

/** The home sidebar's filter of its organizations by name, shown to someone with many (`showsOrganizationFilter`). Esc empties it. */
export function OrganizationFilter({ value, onChange, noMatches }: OrganizationFilterProps) {
  return (
    <div className={styles.filter}>
      <SearchField value={value} onChange={onChange} placeholder="Filter organizations" aria-label="Filter organizations" width="100%" />
      {noMatches && <div className={styles.noMatches}>No matching organizations</div>}
    </div>
  );
}
