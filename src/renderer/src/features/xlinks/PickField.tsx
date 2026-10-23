import { GitBranch, GitCommitVertical, Tag } from 'lucide-react';
import { useId, type InputHTMLAttributes } from 'react';
import { classNames } from '../../lib/classNames';
import fieldStyles from '../../ui/Field.module.css';
import { FieldFrame, type FieldChrome } from '../../ui/TextField';
import { IconButton } from '../../ui/IconButton';
import { pickBranch } from '../branches/BranchPickerDialog';
import { pickChangeset } from '../changesets/ChangesetPickerDialog';
import { pickLabel } from '../labels/LabelPickerDialog';
import styles from './XlinkDialog.module.css';
import type { PickSource, XlinkPointKind } from './xlinkDraft';

type PickFieldProps = FieldChrome &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
    value: string;
    onChange: (value: string) => void;
    /** What its "Choose" button picks, and where. */
    source: PickSource;
  };

const ICONS: Record<XlinkPointKind, typeof GitBranch> = { branch: GitBranch, changeset: GitCommitVertical, label: Tag };

/** The app's picker for each kind, resolving to the text the field holds: a branch's or label's name, a changeset's number. */
async function pick({ kind, title, repository }: PickSource): Promise<string | undefined> {
  switch (kind) {
    case 'branch':
      return (await pickBranch({ title, repository }))?.name;
    case 'changeset': {
      const changeset = await pickChangeset({ title, repository });
      return changeset === undefined ? undefined : String(changeset);
    }
    case 'label':
      return (await pickLabel({ title, repository }))?.name;
  }
}

/**
 * A branch, changeset or label typed, or picked from its repository's with the button beside it, as the legacy
 * client offers its explorer dialogs there.
 */
export function PickField({ value, onChange, source, label, hint, error, className, ...rest }: PickFieldProps) {
  const id = useId();
  const Icon = ICONS[source.kind];
  const choose = async (): Promise<void> => {
    const picked = await pick(source);
    if (picked !== undefined) onChange(picked);
  };

  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <div className={styles.pickField}>
        <input id={id} className={classNames(fieldStyles.input, className)} spellCheck={false} value={value} onChange={(event) => onChange(event.target.value)} {...rest} />
        <IconButton icon={<Icon size={14} />} label={source.unavailable ?? source.chooseLabel} size="small" disabled={Boolean(source.unavailable)} onClick={() => void choose()} />
      </div>
    </FieldFrame>
  );
}
