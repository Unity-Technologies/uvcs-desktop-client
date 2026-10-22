import { useId } from 'react';
import type { RepositorySummary } from '@shared/domain/repository';
import { ServerSelect } from '../../../components/ServerSelect';
import { TextField } from '../../../ui/TextField';
import styles from './HomeDialogs.module.css';
import type { NewWorkspaceForm } from './newWorkspaceForm';

interface RepositoryNameComboboxProps {
  server: string;
  onServerChange: (server: string) => void;
  name: string;
  onNameChange: (name: string) => void;
  /** The server's repositories, suggested as the user types. */
  repositories: readonly RepositorySummary[] | undefined;
  /** Why the server's repositories couldn't be read. */
  error?: string;
  form: Pick<NewWorkspaceForm, 'repositoryList' | 'repositoryNote' | 'repositoryLocked'>;
}

const PLACEHOLDERS: Record<NewWorkspaceForm['repositoryList'], string | undefined> = {
  loading: 'Loading repositories…',
  failed: undefined,
  ready: 'Choose or type a new name',
};

function noteText(note: NewWorkspaceForm['repositoryNote']): string | undefined {
  if (!note) return undefined;
  return note.kind === 'creates' ? 'A new repository, created with the workspace.' : `A new repository: there is one named ${note.existingName}.`;
}

/** A server, then a repository named by picking one of its repositories or typing a new name. */
export function RepositoryNameCombobox({ server, onServerChange, name, onNameChange, repositories, error, form }: RepositoryNameComboboxProps) {
  const suggestionsId = useId();

  return (
    <div className={styles.repositoryRow}>
      <ServerSelect value={server} onChange={onServerChange} disabled={form.repositoryLocked} />
      <TextField
        label="Repository"
        value={name}
        placeholder={PLACEHOLDERS[form.repositoryList]}
        list={suggestionsId}
        readOnly={form.repositoryLocked}
        error={error}
        hint={noteText(form.repositoryNote)}
        onChange={(event) => onNameChange(event.target.value)}
        autoComplete="off"
        autoFocus
      />
      <datalist id={suggestionsId}>
        {repositories?.map((repository) => <option key={repository.spec} value={repository.name} />)}
      </datalist>
    </div>
  );
}
