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
  isMeasured,
  minimumNoteOf,
  movePairsOf,
  moveSimilaritiesKey,
  pairableCount,
  scoredCandidates,
  searchedRows,
  similarityLabel,
  similarityTip,
  type MinimumNote,
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
  const measured = isMeasured(change, candidates.length);
  const similarities = useQuery({
    queryKey: moveSimilaritiesKey(workspacePath, change.path),
    queryFn: () => api.pendingChanges.moveSimilarities(workspacePath, movePairsOf(change, candidates, side)),
    enabled: measured,
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
        loading={measured && similarities.isPending}
        rowHeight={28}
        height={280}
        empty={emptyListWords(words, { search, shown: shown.length, pairable }, candidates.length)}
        note={
          <SearchNote
            note={minimumNoteOf({ change, candidates: candidates.length, pairable, failed: similarities.isError })}
            notMeasured={words.notMeasured}
            minimum={minimum}
            onMinimumChange={setMinimum}
            disabled={!similarities.data}
          />
        }
        renderItem={({ candidate, similarity }) => (
          <ItemPathRow
            path={candidate.path}
            itemType={candidate.itemType}
            extras={<CandidateExtras tag={pairingTag(change, candidate)} similarity={similarity} />}
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

/** What `minimumNoteOf` decided shows under the search. */
function SearchNote({ note, notMeasured, minimum, onMinimumChange, disabled }: { note: MinimumNote; notMeasured: string; minimum: number; onMinimumChange: (value: number) => void; disabled: boolean }) {
  if (note === 'notMeasured') return <p className={styles.notMeasured}>{notMeasured}</p>;
  if (note === 'slider') return <PercentSlider label="Minimum similarity" value={minimum} onChange={onMinimumChange} disabled={disabled} className={styles.minimum} />;
  return null;
}
