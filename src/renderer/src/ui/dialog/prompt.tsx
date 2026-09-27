import { useState } from 'react';
import { Button } from '../Button';
import { TextField } from '../TextField';
import { Dialog } from './Dialog';
import { askDialog } from './dialogStore';

interface PromptOptions {
  title: string;
  label: string;
  initialValue?: string;
  confirmLabel: string;
  description?: string;
  /** Why the value can't be used, shown under the field while it can't; undefined when it can. */
  validate?: (value: string) => string | undefined;
}

/** Asks for a single line of text, e.g. a new name. Resolves to `undefined` if cancelled. */
export function prompt(options: PromptOptions): Promise<string | undefined> {
  return askDialog<string>((finish) => <PromptDialog {...options} finish={finish} />);
}

function PromptDialog({
  title,
  label,
  initialValue = '',
  confirmLabel,
  description,
  validate,
  finish,
}: PromptOptions & { finish: (value: string | undefined) => void }) {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();
  const error = trimmed ? validate?.(trimmed) : undefined;

  return (
    <Dialog
      title={title}
      description={description}
      onClose={() => finish(undefined)}
      onSubmit={() => trimmed && !error && finish(trimmed)}
      footer={
        <>
          <Button onClick={() => finish(undefined)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!trimmed || trimmed === initialValue || Boolean(error)}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <TextField label={label} value={value} error={error} onChange={(event) => setValue(event.target.value)} autoFocus onFocus={(event) => event.target.select()} />
    </Dialog>
  );
}
