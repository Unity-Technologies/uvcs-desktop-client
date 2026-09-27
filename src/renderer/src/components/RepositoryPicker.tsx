import { useState } from 'react';
import type { RepositorySummary } from '@shared/domain/repository';
import { useRepositories, useServers } from '../app/workspace/workspaceQueries';
import { serverChoiceLabel, splitRepositorySpec } from '../lib/servers';
import { SelectField } from '../ui/TextField';
import styles from './RepositoryPicker.module.css';

interface RepositoryPickerProps {
  /** Selected repository spec (`name@server`). */
  value: string | null;
  onChange: (repository: RepositorySummary) => void;
  /** Repositories that can't be picked, e.g. the source of a push. */
  exclude?: string;
  label?: string;
}

/** Picks a server, then one of its repositories. */
export function RepositoryPicker({ value, onChange, exclude, label = 'Repository' }: RepositoryPickerProps) {
  const [server, setServer] = useState(() => (value ? splitRepositorySpec(value).server : 'local'));
  const { data: servers } = useServers();
  const { data: repositories, isLoading, error } = useRepositories(server);
  const choices = (repositories ?? []).filter((repository) => repository.spec !== exclude);

  return (
    <div className={styles.picker}>
      <SelectField label="Server" value={server} onChange={(event) => setServer(event.target.value)}>
        {(servers?.map((profile) => profile.server) ?? [server]).map((name) => (
          <option key={name} value={name}>
            {serverChoiceLabel(name)}
          </option>
        ))}
      </SelectField>
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
