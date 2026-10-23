import { MapPin } from 'lucide-react';
import { ProjectIcon } from '../../components/ProjectIcon';
import { ServerIcon } from '../../components/ServerIcon';
import { PickFilter } from './PickFilter';
import { matchingPlaces, placeKey, placeLabel, samePlace, type PlaceChoice, type WorkspacePlace } from './workspacePlaces';

interface PlaceFilterProps {
  choices: PlaceChoice[];
  /** The place picked, none for everywhere. */
  place: WorkspacePlace | null;
  onChange: (place: WorkspacePlace | null) => void;
}

/** All workspaces' filter by where their repositories live: an organization or server, or a Unity project in one. */
export function PlaceFilter({ choices, place, onChange }: PlaceFilterProps) {
  return (
    <PickFilter
      chip={{ icon: <MapPin size={13} />, label: placeLabel(place), active: place !== null }}
      name="Place"
      rowsLabel="Places"
      all={{ label: 'Everywhere', checked: place === null }}
      choices={choices}
      matching={matchingPlaces}
      rowOf={(choice) => ({
        key: placeKey(choice.place),
        icon: choice.place.project === undefined ? <ServerIcon server={choice.place.server} size={13} /> : <ProjectIcon guid={choice.guid} size={16} />,
        label: choice.label,
        count: choice.workspaceCount,
        picked: samePlace(choice.place, place),
        nested: choice.place.project !== undefined,
      })}
      placeholder="Find an organization or project"
      empty="No matching places"
      onPick={(picked) => onChange(picked?.place ?? null)}
    />
  );
}
