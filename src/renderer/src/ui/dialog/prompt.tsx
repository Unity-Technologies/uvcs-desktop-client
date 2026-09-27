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
  /** What's wrong with the text, shown under the field while it stands in the way of confirming. */
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
  const problem = trimmed && trimmed !== initialValue ? validate?.(trimmed) : undefined;

  return (
    <Dialog
      title={title}
      description={description}
      onClose={() => finish(undefined)}
      onSubmit={() => trimmed && !problem && finish(trimmed)}
      footer={
        <>
          <Button onClick={() => finish(undefined)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!trimmed || trimmed === initialValue || problem !== undefined}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <TextField label={label} value={value} error={problem} onChange={(event) => setValue(event.target.value)} autoFocus onFocus={(event) => event.target.select()} />
    </Dialog>
  );
}
