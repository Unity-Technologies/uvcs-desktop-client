import { useQuery } from '@tanstack/react-query';
import { useId, useMemo, useState } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useSettings } from '../../app/settings/useSettings';
import { ItemPathRow } from '../../components/ItemPathRow';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { PickList } from '../../ui/PickList';
import { DEFAULT_MINIMUM_SIMILARITY, isScored, movePairsOf, scoredCandidates, searchedRows, similarityLabel, similarityTip } from './matchSimilarity';
import { matchCandidates, moveMatchOf, type MatchSide, type MoveMatch } from './moveMatches';
import { emptyListWords, matchDialogWords } from './moveMatchWords';
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
    queryKey: queryKeys.inWorkspace(workspacePath, 'pendingChanges', 'moveSimilarities', change.path),
    queryFn: () => api.pendingChanges.moveSimilarities(workspacePath, movePairsOf(change, candidates, side)),
    enabled: scored,
    // Measured once while the dialog shows: the slider filters what was measured.
    staleTime: Infinity,
    gcTime: 0,
  });
  const rows = useMemo(() => scoredCandidates(candidates, similarities.data, minimum), [candidates, similarities.data, minimum]);
  const shown = useMemo(() => searchedRows(rows, search), [rows, search]);
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
        empty={emptyListWords(words, search)}
        note={scored && <MinimumSimilarity value={minimum} onChange={setMinimum} disabled={!similarities.data} />}
        renderItem={({ candidate, similarity }) => (
          <ItemPathRow
            path={candidate.path}
            itemType={candidate.itemType}
            extras={
              scored &&
              similarities.data && (
                <span className={styles.similarity} data-tip={similarityTip(similarity)}>
                  {similarityLabel(similarity)}
                </span>
              )
            }
          />
        )}
      />
    </Dialog>
  );
}

function MinimumSimilarity({ value, onChange, disabled }: { value: number; onChange: (value: number) => void; disabled: boolean }) {
  const id = useId();
  return (
    <div className={styles.minimum}>
      <label htmlFor={id}>Minimum similarity</label>
      <input id={id} type="range" min={0} max={100} step={5} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
      <span className={styles.minimumValue}>{value}%</span>
    </div>
  );
}
