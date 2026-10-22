import { useId } from 'react';
import type { RepositorySummary } from '@shared/domain/repository';
import { TextField } from '../ui/TextField';
import styles from './RepositoryPicker.module.css';
import { ServerSelect } from './ServerSelect';

interface RepositoryNameComboboxProps {
  server: string;
  onServerChange: (server: string) => void;
  name: string;
  onNameChange: (name: string) => void;
  /** The server's repositories, suggested as the user types; undefined while they are read. */
  repositories: readonly RepositorySummary[] | undefined;
  /** Why the server's repositories couldn't be read. */
  error?: string;
  /** The name typed is none of the server's repositories: it will be created. */
  createsRepository: boolean;
  /** The repository exists already (an earlier try made it): it can no longer change. */
  locked: boolean;
}

/**
 * A server, then a repository named by picking one of its repositories or typing a new name. It lives next to
 * `RepositoryPicker` to share its layout (`RepositoryPicker.module.css`).
 */
export function RepositoryNameCombobox({ server, onServerChange, name, onNameChange, repositories, error, createsRepository, locked }: RepositoryNameComboboxProps) {
  const suggestionsId = useId();

  return (
    <div className={styles.picker}>
      <ServerSelect value={server} onChange={onServerChange} disabled={locked} />
      <TextField
        label="Repository"
        value={name}
        placeholder={repositories ? 'Choose or type a new name' : 'Loading repositories…'}
        list={suggestionsId}
        readOnly={locked}
        error={error}
        hint={createsRepository ? 'A new repository, created with the workspace.' : undefined}
        onChange={(event) => onNameChange(event.target.value)}
        autoComplete="off"
      />
      <datalist id={suggestionsId}>
        {repositories?.map((repository) => <option key={repository.spec} value={repository.name} />)}
      </datalist>
    </div>
  );
}
