import { Tag } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Label } from '@shared/domain/label';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { Highlight } from '../../ui/Highlight';
import { PickList } from '../../ui/PickList';
import { labelChoices } from './labelFilters';
import { useLabels } from './useLabels';
import styles from './LabelPickerDialog.module.css';

interface PickLabelOptions {
  title: string;
  /** A label not to offer, e.g. the one being compared. */
  exclude?: string;
  /** Another repository's labels than the workspace's (`name@server`), e.g. an xlinked one's. */
  repository?: string;
}

/** Asks the user to choose a label. Resolves to it, or undefined if dismissed. */
export function pickLabel(options: PickLabelOptions): Promise<Label | undefined> {
  return askDialog<Label>((finish) => <LabelPickerDialog {...options} finish={finish} />);
}

function LabelPickerDialog({ title, exclude, repository, finish }: PickLabelOptions & { finish: (label: Label | undefined) => void }) {
  const { data: labels } = useLabels({}, repository);
  const [search, setSearch] = useState('');
  const choices = useMemo(() => labelChoices(labels ?? [], exclude, search), [labels, exclude, search]);

  return (
    <Dialog title={title} width={460} onClose={() => finish(undefined)}>
      <PickList
        items={choices}
        itemKey={(label) => String(label.id)}
        search={search}
        onSearchChange={setSearch}
        placeholder="Find a label"
        label="Labels"
        onPick={finish}
        loading={!labels}
        rowHeight={30}
        empty="No labels found."
        renderItem={(label) => (
          <>
            <Tag size={13} className={styles.icon} />
            <span className={styles.name}>
              <Highlight text={label.name} />
            </span>
            <span className={styles.changeset}>cs:{label.changeset}</span>
          </>
        )}
      />
    </Dialog>
  );
}
