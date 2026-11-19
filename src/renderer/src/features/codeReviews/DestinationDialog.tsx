import { useCallback } from 'react';
import type { Branch } from '@shared/domain/branch';
import type { Place } from '@shared/domain/place';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { BranchChoiceList } from '../branches/BranchChoiceList';
import type { ChangeableDestination } from './changeableDestination';
import { destinationGroups } from './destinationChoices';

interface PickDestinationOptions {
  place: Place;
  /** The merge request's title, under the dialog's. */
  title: string;
  changeable: ChangeableDestination;
}

/**
 * Asks where a merge request merges, from a list or a menu, with the page's branch list (`DestinationPicker`): the
 * source's ancestors first, then any branch by typing. Resolves to the branch picked, or undefined when dismissed.
 */
export function pickDestination(options: PickDestinationOptions): Promise<Branch | undefined> {
  return askDialog<Branch>((finish) => <DestinationDialog {...options} finish={finish} />);
}

function DestinationDialog({ place, title, changeable, finish }: PickDestinationOptions & { finish: (branch: Branch | undefined) => void }) {
  const { source, destination } = changeable;
  const destinationChoices = useCallback((branches: Branch[]) => destinationGroups(branches, source), [source]);
  return (
    <Dialog title="Change destination" description={title} width={480} onClose={() => finish(undefined)}>
      <BranchChoiceList place={place} groupsOf={destinationChoices} current={destination} placeholder="Merge into…" onPick={finish} onLeave={() => finish(undefined)} />
    </Dialog>
  );
}
