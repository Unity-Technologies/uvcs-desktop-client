import { CommentLine } from '../../components/comments/CommentLine';
import type { Place } from '@shared/domain/place';
import { useQuery } from '@tanstack/react-query';
import { GitCommitVertical } from 'lucide-react';
import { useMemo, useState } from 'react';
import { usePlace } from '../../app/workspace/useWorkspace';
import { branchLabel } from '../../lib/branchLabels';
import { typedChangesetNumber } from '../../lib/changesetNumber';
import { firstLine } from '../../lib/text';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { Highlight } from '../../ui/Highlight';
import { PickList } from '../../ui/PickList';
import { changesetChoices, type ChangesetChoice } from './changesetFilters';
import { RECENT_CHANGESETS, recentChangesetsQuery } from './recentChangesets';
import styles from './ChangesetPickerDialog.module.css';

interface PickChangesetOptions {
  title: string;
  /** The changeset not to offer: the one being compared. */
  exclude?: number;
  /** Another place's changesets than the window's, e.g. an xlinked repository's (`repositoryPlace`). */
  place?: Place;
}

/**
 * Asks the user to choose a changeset: one of the newest (the palette's list, `recentChangesetsQuery`), or any other
 * by its number. Resolves to its number, or undefined if dismissed.
 */
export async function pickChangeset(options: PickChangesetOptions): Promise<number | undefined> {
  return (await askDialog<ChangesetChoice>((finish) => <ChangesetPickerDialog {...options} finish={finish} />))?.id;
}

function ChangesetPickerDialog({ title, exclude, place, finish }: PickChangesetOptions & { finish: (choice: ChangesetChoice | undefined) => void }) {
  const windowPlace = usePlace();
  const { data: recent, error } = useQuery(recentChangesetsQuery(place ?? windowPlace));
  const [search, setSearch] = useState('');
  const choices = useMemo(() => changesetChoices(recent, RECENT_CHANGESETS, exclude, search), [recent, exclude, search]);
  // A number typed is picked without the list: only an empty or text search waits for it.
  const waiting = !recent && !error && typedChangesetNumber(search) === undefined;

  return (
    <Dialog title={title} width={560} onClose={() => finish(undefined)}>
      <PickList
        items={choices}
        itemKey={(choice) => String(choice.id)}
        search={search}
        onSearchChange={setSearch}
        placeholder="Find a changeset or type its number"
        label="Changesets"
        onPick={finish}
        isDisabled={(choice) => choice.missing === true}
        loading={waiting}
        rowHeight={30}
        empty={error ? `Couldn't read the changesets: ${error.message}. Type a number to pick one.` : 'No changesets found. Type a number to pick an older one.'}
        renderItem={({ id, changeset, missing }) => (
          <>
            <GitCommitVertical size={13} className={styles.icon} />
            <span className={styles.number}>
              <Highlight text={String(id)} />
            </span>
            <span className={styles.comment}>{changeset ? <ChangesetComment comment={changeset.comment} /> : <span className={styles.muted}>{missing ? `No changeset ${id}` : `Changeset ${id}`}</span>}</span>
            {changeset && (
              <span className={styles.branch}>
                <Highlight text={branchLabel(changeset.branch)} />
              </span>
            )}
          </>
        )}
      />
    </Dialog>
  );
}

function ChangesetComment({ comment }: { comment: string }) {
  const title = firstLine(comment).trim();
  return title ? <CommentLine comment={title} interactive={false} /> : <span className={styles.muted}>No comment</span>;
}
