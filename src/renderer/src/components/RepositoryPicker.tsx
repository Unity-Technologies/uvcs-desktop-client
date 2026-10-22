import { useState } from 'react';
import type { RepositorySummary } from '@shared/domain/repository';
import { useRepositories } from '../app/workspace/workspaceQueries';
import { splitRepositorySpec } from '../lib/servers';
import { SelectField } from '../ui/TextField';
import styles from './RepositoryPicker.module.css';
import { ServerSelect } from './ServerSelect';

interface RepositoryPickerProps {
  /** Selected repository spec (`name@server`). */
  value: string | null;
  onChange: (repository: RepositorySummary) => void;
  /** Repositories that can't be picked, e.g. the source of a push. */
  exclude?: string;
  label?: string;
  /** The server shown, when the caller keeps it (e.g. to share it with other fields); the picker keeps its own otherwise. */
  server?: string;
  onServerChange?: (server: string) => void;
}

/** Picks a server, then one of its repositories. */
export function RepositoryPicker({ value, onChange, exclude, label = 'Repository', server: shownServer, onServerChange }: RepositoryPickerProps) {
  const [ownServer, setOwnServer] = useState(() => (value ? splitRepositorySpec(value).server : 'local'));
  const server = shownServer ?? ownServer;
  const setServer = onServerChange ?? setOwnServer;
  const { data: repositories, isLoading, error } = useRepositories(server);
  const choices = (repositories ?? []).filter((repository) => repository.spec !== exclude);

  return (
    <div className={styles.picker}>
      <ServerSelect value={server} onChange={setServer} />
      <SelectField
        label={label}
        value={value && splitRepositorySpec(value).server === server ? value : ''}
        disabled={isLoading || Boolean(error)}
        error={error?.message}
        onChange={(event) => {
          const picked = choices.find((repository) => repository.spec === event.target.value);
          if (picked) onChange(picked);
        }}
      >
        <option value="" disabled>
          {isLoading ? 'Loading repositories…' : choices.length === 0 ? 'No repositories' : 'Choose a repository'}
        </option>
        {choices.map((repository) => (
          <option key={repository.spec} value={repository.spec}>
            {repository.name}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
