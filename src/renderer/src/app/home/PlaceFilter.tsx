import { Globe, MapPin } from 'lucide-react';
import { ProjectIcon } from '../../components/ProjectIcon';
import { ServerIcon } from '../../components/ServerIcon';
import { holdsCount } from '../../lib/text';
import { PickFilter } from './PickFilter';
import { matchingPlaces, placeKey, placeLabel, samePlace, type PlaceChoice, type WorkspacePlace } from './workspacePlaces';

interface PlaceFilterProps {
  choices: PlaceChoice[];
  /** Every workspace, as "Everywhere" counts them. */
  workspaceCount: number;
  /** The place picked, none for everywhere. */
  place: WorkspacePlace | null;
  onChange: (place: WorkspacePlace | null) => void;
}

const workspacesIn = (count: number): string => holdsCount(count, 'workspace');

/** All workspaces' filter by where their repositories live: an organization or server, or a Unity project in one. */
export function PlaceFilter({ choices, workspaceCount, place, onChange }: PlaceFilterProps) {
  return (
    <PickFilter
      trigger={{ icon: <MapPin size={13} />, label: placeLabel(place) }}
      name="Place"
      rowsLabel="Places"
      all={{ icon: <Globe size={13} />, label: 'Everywhere', detail: workspacesIn(workspaceCount), picked: place === null }}
      choices={choices}
      matching={matchingPlaces}
      rowOf={(choice) => ({
        key: placeKey(choice.place),
        icon: choice.place.project === undefined ? <ServerIcon server={choice.place.server} size={13} /> : <ProjectIcon guid={choice.guid} size={16} />,
        label: choice.label,
        detail: workspacesIn(choice.workspaceCount),
        picked: samePlace(choice.place, place),
        nested: choice.place.project !== undefined,
      })}
      placeholder="Find an organization or project"
      empty="No matching places"
      onPick={(picked) => onChange(picked?.place ?? null)}
    />
  );
}
