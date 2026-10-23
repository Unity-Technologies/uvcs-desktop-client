import { useMemo, useState } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { useSettings } from '../../app/settings/useSettings';
import { ItemPathRow } from '../../components/ItemPathRow';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { PickList } from '../../ui/PickList';
import { matchCandidates, moveMatchOf, searchedCandidates, type MatchSide, type MoveMatch } from './moveMatches';
import { emptyListWords, matchDialogWords } from './moveMatchWords';

interface MoveMatchDialogProps {
  change: PendingChange;
  side: MatchSide;
  /** The changes the menu was built from, which the candidates come from: the dialog reads nothing. */
  listed: readonly PendingChange[];
}

/** "Search matches": asks which item is the other side of the change's move. Resolves to the move, or undefined if dismissed. */
export function pickMoveMatch(props: MoveMatchDialogProps): Promise<MoveMatch | undefined> {
  return askDialog<MoveMatch>((finish) => <MoveMatchDialog {...props} finish={finish} />);
}

function MoveMatchDialog({ change, side, listed, finish }: MoveMatchDialogProps & { finish: (match: MoveMatch | undefined) => void }) {
  const { pendingChanges: filter } = useSettings();
  const [search, setSearch] = useState('');
  const candidates = useMemo(() => matchCandidates(change, listed), [change, listed]);
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
        rowHeight={28}
        height={280}
        empty={emptyListWords(words, search)}
        renderItem={(candidate) => <ItemPathRow path={candidate.path} itemType={candidate.itemType} />}
      />
    </Dialog>
  );
}
