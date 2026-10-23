import { GitBranch } from 'lucide-react';
import { useId, type InputHTMLAttributes } from 'react';
import { classNames } from '../../lib/classNames';
import fieldStyles from '../../ui/Field.module.css';
import { FieldFrame, type FieldChrome } from '../../ui/TextField';
import { IconButton } from '../../ui/IconButton';
import { pickBranch } from '../branches/BranchPickerDialog';
import styles from './XlinkDialog.module.css';
import type { BranchSource } from './xlinkDraft';

type BranchFieldProps = FieldChrome &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
    value: string;
    onChange: (branch: string) => void;
    /** Where its picker lists branches. */
    source: BranchSource;
  };

/** A branch typed by name, or picked from its repository's branches, as the legacy client's branch explorer dialog does. */
export function BranchField({ value, onChange, source, label, hint, error, className, ...rest }: BranchFieldProps) {
  const id = useId();
  const choose = async (): Promise<void> => {
    const picked = await pickBranch({ title: source.title, repository: source.repository });
    if (picked) onChange(picked.name);
  };

  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <div className={styles.branchField}>
        <input id={id} className={classNames(fieldStyles.input, className)} spellCheck={false} value={value} onChange={(event) => onChange(event.target.value)} {...rest} />
        <IconButton icon={<GitBranch size={14} />} label={source.unavailable ?? 'Choose a branch'} size="small" disabled={Boolean(source.unavailable)} onClick={() => void choose()} />
      </div>
    </FieldFrame>
  );
}
