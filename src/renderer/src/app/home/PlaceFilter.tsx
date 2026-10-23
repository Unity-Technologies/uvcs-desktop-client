import { MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ServerIcon } from '../../components/ServerIcon';
import { formatCount } from '../../lib/text';
import { FilterOptions } from '../../ui/FilterOptions';
import { FilterPopover } from '../../ui/FilterPopover';
import { Highlight } from '../../ui/Highlight';
import { PickList } from '../../ui/PickList';
import { MenuChip } from '../../ui/ToggleChip';
import { matchingPlaces, placeKey, placeLabel, samePlace, type PlaceChoice, type WorkspacePlace } from './workspacePlaces';
import styles from './Home.module.css';

const ROW_HEIGHT = 32;

interface PlaceFilterProps {
  choices: PlaceChoice[];
  /** The place picked, none for everywhere. */
  place: WorkspacePlace | null;
  onChange: (place: WorkspacePlace | null) => void;
}

/** All workspaces' filter by where their repositories live: an organization or server, or a Unity project in one. */
export function PlaceFilter({ choices, place, onChange }: PlaceFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const shown = useMemo(() => matchingPlaces(choices, search), [choices, search]);
  const choose = (picked: WorkspacePlace | null): void => {
    setOpen(false);
    setSearch('');
    onChange(picked);
  };

  return (
    <FilterPopover
      open={open}
      onOpenChange={setOpen}
      width={320}
      trigger={
        <MenuChip icon={<MapPin size={13} />} active={place !== null} aria-label={`Place: ${placeLabel(place)}`}>
          <span className={styles.projectChipName}>{placeLabel(place)}</span>
        </MenuChip>
      }
    >
      <FilterOptions label="Places" kind="radio" options={[{ id: 'everywhere', label: 'Everywhere', checked: place === null, onSelect: () => choose(null) }]} />
      <PickList
        items={shown}
        itemKey={(choice) => placeKey(choice.place)}
        search={search}
        onSearchChange={setSearch}
        placeholder="Find an organization or project"
        label="Places"
        onPick={(choice) => choose(choice.place)}
        rowHeight={ROW_HEIGHT}
        empty="No matching places"
        renderItem={(choice) => (
          <span className={styles.projectChoice} data-picked={samePlace(choice.place, place)} data-nested={choice.place.project !== undefined}>
            {choice.place.project === undefined && <ServerIcon server={choice.place.server} size={13} />}
            <span className={styles.projectChoiceName}>
              <Highlight text={choice.label} />
            </span>
            <span className={styles.projectChoiceCount}>{formatCount(choice.workspaceCount)}</span>
          </span>
        )}
      />
    </FilterPopover>
  );
}
