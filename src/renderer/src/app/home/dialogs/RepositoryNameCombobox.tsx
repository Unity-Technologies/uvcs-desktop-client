import type { RepositorySummary } from '@shared/domain/repository';
import { ServerSelect } from '../../../components/ServerSelect';
import { Combobox } from '../../../ui/Combobox';
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
  return (
    <div className={styles.repositoryRow}>
      <ServerSelect value={server} onChange={onServerChange} disabled={form.repositoryLocked} />
      <Combobox
        label="Repository"
        value={name}
        onChange={onNameChange}
        options={repositories?.map((repository) => repository.name) ?? []}
        optionsLabel="Repositories"
        placeholder={PLACEHOLDERS[form.repositoryList]}
        readOnly={form.repositoryLocked}
        error={error}
        hint={noteText(form.repositoryNote)}
        autoFocus
      />
    </div>
  );
}
