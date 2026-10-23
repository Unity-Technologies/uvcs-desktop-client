import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { api } from '../../api/client';
import { useSettings } from '../../app/settings/useSettings';
import { ItemPathRow } from '../../components/ItemPathRow';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { PercentSlider } from '../../ui/PercentSlider';
import { PickList } from '../../ui/PickList';
import { ItemTag } from '../../components/ItemTag';
import {
  DEFAULT_MINIMUM_SIMILARITY,
  isScored,
  movePairsOf,
  moveSimilaritiesKey,
  pairableCount,
  scoredCandidates,
  searchedRows,
  showsMinimum,
  similarityLabel,
  similarityTip,
} from './matchSimilarity';
import { matchCandidates, moveMatchOf, type MatchSide, type MoveMatch } from './moveMatches';
import { emptyListWords, matchDialogWords, pairingTag, type PairingTag } from './moveMatchWords';
import styles from './MoveMatchDialog.module.css';

interface MoveMatchDialogProps {
  workspacePath: string;
  change: PendingChange;
  side: MatchSide;
  /** The changes the menu was built from, which the candidates come from: the dialog lists nothing again. */
  listed: readonly PendingChange[];
}

/** "Search matches": asks which item is the other side of the change's move. Resolves to the move, or undefined if dismissed. */
export function pickMoveMatch(props: MoveMatchDialogProps): Promise<MoveMatch | undefined> {
  return askDialog<MoveMatch>((finish) => <MoveMatchDialog {...props} finish={finish} />);
}

function MoveMatchDialog({ workspacePath, change, side, listed, finish }: MoveMatchDialogProps & { finish: (match: MoveMatch | undefined) => void }) {
  const { pendingChanges: filter } = useSettings();
  const [search, setSearch] = useState('');
  const [minimum, setMinimum] = useState(DEFAULT_MINIMUM_SIMILARITY);
  const candidates = useMemo(() => matchCandidates(change, listed), [change, listed]);
  const scored = isScored(change) && candidates.length > 0;
  const similarities = useQuery({
    queryKey: moveSimilaritiesKey(workspacePath, change.path),
    queryFn: () => api.pendingChanges.moveSimilarities(workspacePath, movePairsOf(change, candidates, side)),
    enabled: scored,
    // Measured once as the dialog opens: the slider filters what was measured.
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
  const rows = useMemo(() => scoredCandidates(candidates, similarities.data, minimum), [candidates, similarities.data, minimum]);
  const shown = useMemo(() => searchedRows(rows, search), [rows, search]);
  const pairable = pairableCount(similarities.data);
  const words = matchDialogWords(change, side, filter.showPrivate);

  return (
    <Dialog title={words.title} description={words.description} width={600} onClose={() => finish(undefined)}>
      <PickList
        items={shown}
        itemKey={(row) => row.candidate.path}
        search={search}
        onSearchChange={setSearch}
        placeholder={words.placeholder}
        label={words.listLabel}
        onPick={(row) => finish(moveMatchOf(change, row.candidate, side))}
        loading={scored && similarities.isPending}
        rowHeight={28}
        height={280}
        empty={emptyListWords(words, { search, shown: shown.length, pairable }, candidates.length)}
        note={
          similarities.isError ? (
            <p className={styles.notMeasured}>{words.notMeasured}</p>
          ) : (
            showsMinimum(change, candidates.length, pairable) && (
              <PercentSlider label="Minimum similarity" value={minimum} onChange={setMinimum} disabled={!similarities.data} className={styles.minimum} />
            )
          )
        }
        renderItem={({ candidate, similarity }) => (
          <ItemPathRow
            path={candidate.path}
            itemType={candidate.itemType}
            extras={<CandidateExtras tag={pairingTag(change, candidate)} similarity={similarities.data ? similarity : undefined} />}
          />
        )}
      />
    </Dialog>
  );
}

/** What the detection paired the candidate with, then how alike it is, once measured (undefined until then). */
function CandidateExtras({ tag, similarity }: { tag: PairingTag | null; similarity: number | null | undefined }) {
  return (
    <>
      {tag && <ItemTag tip={tag.tip}>{tag.label}</ItemTag>}
      {similarity !== undefined && (
        <span className={styles.similarity} data-tip={similarityTip(similarity)}>
          {similarityLabel(similarity)}
        </span>
      )}
    </>
  );
}
