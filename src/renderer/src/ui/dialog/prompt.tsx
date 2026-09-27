import { useState } from 'react';
import { Button } from '../Button';
import { TextField } from '../TextField';
import { Dialog } from './Dialog';
import { askDialog } from './dialogStore';
import { promptAnswer } from './promptAnswer';

interface PromptOptions {
  title: string;
  label: string;
  initialValue?: string;
  confirmLabel: string;
  description?: string;
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
  finish,
}: PromptOptions & { finish: (value: string | undefined) => void }) {
  const [value, setValue] = useState(initialValue);
  const answer = promptAnswer(value, initialValue);

  return (
    <Dialog
      title={title}
      description={description}
      onClose={() => finish(undefined)}
      onSubmit={() => answer && finish(answer)}
      footer={
        <>
          <Button onClick={() => finish(undefined)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!answer}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <TextField label={label} value={value} onChange={(event) => setValue(event.target.value)} autoFocus onFocus={(event) => event.target.select()} />
    </Dialog>
  );
}
