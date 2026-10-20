import { useQuery } from '@tanstack/react-query';
import { GitCommitVertical } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { branchLabel } from '../../lib/branchLabels';
import { firstLine } from '../../lib/text';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { Highlight } from '../../ui/Highlight';
import { PickList } from '../../ui/PickList';
import { changesetChoices, type ChangesetChoice } from './changesetFilters';
import { recentChangesetsQuery } from './recentChangesets';
import styles from './ChangesetPickerDialog.module.css';

interface PickChangesetOptions {
  title: string;
  /** The changeset not to offer: the one being compared. */
  exclude: number;
}

/**
 * Asks the user to choose a changeset: one of the newest (the palette's list, `recentChangesetsQuery`), or any other
 * by its number. Resolves to its number, or undefined if dismissed.
 */
export async function pickChangeset(options: PickChangesetOptions): Promise<number | undefined> {
  return (await askDialog<ChangesetChoice>((finish) => <ChangesetPickerDialog {...options} finish={finish} />))?.id;
}

function ChangesetPickerDialog({ title, exclude, finish }: PickChangesetOptions & { finish: (choice: ChangesetChoice | undefined) => void }) {
  const { data: recent } = useQuery(recentChangesetsQuery(useWorkspacePath()));
  const [search, setSearch] = useState('');
  const choices = useMemo(() => changesetChoices(recent ?? [], exclude, search), [recent, exclude, search]);

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
        loading={!recent}
        rowHeight={30}
        empty="No changesets found. Type a number to pick an older one."
        renderItem={({ id, changeset }) => (
          <>
            <GitCommitVertical size={13} className={styles.icon} />
            <span className={styles.number}>
              <Highlight text={String(id)} />
            </span>
            <span className={styles.comment}>{changeset ? <ChangesetComment comment={changeset.comment} /> : <span className={styles.muted}>Changeset {id}</span>}</span>
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
  return title ? <Highlight text={title} /> : <span className={styles.muted}>No comment</span>;
}
