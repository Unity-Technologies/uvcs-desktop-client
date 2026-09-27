import { Tag } from 'lucide-react';
import { useState } from 'react';
import type { Label } from '@shared/domain/label';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { SearchField } from '../../ui/SearchField';
import { CenteredSpinner } from '../../ui/Spinner';
import { useLabels } from './useLabels';
import styles from './LabelPickerDialog.module.css';

interface PickLabelOptions {
  title: string;
  /** A label not to offer, e.g. the one being compared. */
  exclude?: string;
}

/** Asks the user to choose a label. Resolves to it, or undefined if dismissed. */
export function pickLabel(options: PickLabelOptions): Promise<Label | undefined> {
  return askDialog<Label>((finish) => <LabelPickerDialog {...options} finish={finish} />);
}

function LabelPickerDialog({ title, exclude, finish }: PickLabelOptions & { finish: (label: Label | undefined) => void }) {
  const { data: labels } = useLabels();
  const [search, setSearch] = useState('');
  const visible = (labels ?? []).filter((label) => label.name !== exclude && matchesWordFilter([label.name], search));

  return (
    <Dialog title={title} width={460} onClose={() => finish(undefined)}>
      <SearchField value={search} onChange={setSearch} placeholder="Find a label" autoFocus width={420} />
      {labels ? (
        <HighlightQuery query={search}>
          <div className={styles.list}>
            {visible.map((label) => (
              <button key={label.id} type="button" className={styles.item} onClick={() => finish(label)}>
                <Tag size={13} className={styles.icon} />
                <span className={styles.name}>
                  <Highlight text={label.name} />
                </span>
                <span className={styles.changeset}>cs:{label.changeset}</span>
              </button>
            ))}
            {visible.length === 0 && <div className={styles.empty}>No labels found.</div>}
          </div>
        </HighlightQuery>
      ) : (
        <CenteredSpinner />
      )}
    </Dialog>
  );
}
