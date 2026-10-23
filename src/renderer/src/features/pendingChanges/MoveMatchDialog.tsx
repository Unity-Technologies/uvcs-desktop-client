import { useMemo, useState } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { useSettings } from '../../app/settings/useSettings';
import { ItemPathRow } from '../../components/ItemPathRow';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { PickList } from '../../ui/PickList';
import { matchCandidates, moveMatchOf, searchedCandidates, type MatchSide, type MoveMatch } from './moveMatches';
import { emptyListWords, matchDialogWords } from './moveMatchWords';
import { usePendingChangesOf } from './usePendingChanges';

interface MoveMatchDialogProps {
  workspacePath: string;
  change: PendingChange;
  side: MatchSide;
}

/** "Search matches": asks which item is the other side of the change's move. Resolves to the move, or undefined if dismissed. */
export function pickMoveMatch(props: MoveMatchDialogProps): Promise<MoveMatch | undefined> {
  return askDialog<MoveMatch>((finish) => <MoveMatchDialog {...props} finish={finish} />);
}

function MoveMatchDialog({ workspacePath, change, side, finish }: MoveMatchDialogProps & { finish: (match: MoveMatch | undefined) => void }) {
  // The changes Changes already read: offering them asks `cm` nothing.
  const { data: snapshot } = usePendingChangesOf(workspacePath);
  const { pendingChanges: filter } = useSettings();
  const [search, setSearch] = useState('');
  const candidates = useMemo(() => matchCandidates(change, snapshot?.changes ?? []), [change, snapshot]);
  const shown = useMemo(() => searchedCandidates(candidates, search), [candidates, search]);
  const words = matchDialogWords(change, side, filter.showPrivate);

  return (
    <Dialog title={words.title} description={words.description} width={560} onClose={() => finish(undefined)}>
      <PickList
        items={shown}
        itemKey={(candidate) => candidate.path}
        search={search}
        onSearchChange={setSearch}
        placeholder={words.placeholder}
        label={words.listLabel}
        onPick={(candidate) => finish(moveMatchOf(change, candidate, side))}
        loading={!snapshot}
        rowHeight={28}
        height={280}
        empty={emptyListWords(words, search)}
        renderItem={(candidate) => <ItemPathRow path={candidate.path} itemType={candidate.itemType} />}
      />
    </Dialog>
  );
}
