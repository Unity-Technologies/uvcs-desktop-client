import { useState } from 'react';
import { Button } from '../../ui/Button';
import { confirm } from '../../ui/dialog/confirm';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { OptionCards } from '../../ui/OptionCards';
import { checkForUpdates, setAboutOpen } from '../updates/updateStore';
import { linkProblemWords, type LinkFailure } from './linkProblemWords';

/** Says why a link couldn't open; one a newer version wrote offers to check for updates (the About dialog). */
export async function showLinkFailure(failure: LinkFailure): Promise<void> {
  const { title, message, offersUpdate } = linkProblemWords(failure);
  if (offersUpdate) {
    if (await confirm({ title, message, confirmLabel: 'Check for updates' })) {
      setAboutOpen(true);
      void checkForUpdates();
    }
    return;
  }
  await askDialog<void>((finish) => (
    <Dialog
      title={title}
      description={message}
      onClose={() => finish(undefined)}
      onSubmit={() => finish(undefined)}
      footer={
        <Button type="submit" variant="primary" autoFocus>
          OK
        </Button>
      }
    />
  ));
}

/** A workspace a link may open in, as the picker shows it. */
export interface LinkWorkspaceChoice {
  path: string;
  name: string;
  /** What it's on, in words ("/main/task001", "changeset 12"); undefined when not known. */
  on?: string;
}

/** Asks which of several workspaces on the repository opens the link, the first one picked; undefined if cancelled. */
export function pickLinkWorkspace(repositoryName: string, choices: readonly LinkWorkspaceChoice[]): Promise<string | undefined> {
  return askDialog<string>((finish) => <LinkWorkspacePicker repositoryName={repositoryName} choices={choices} finish={finish} />);
}

function LinkWorkspacePicker({ repositoryName, choices, finish }: { repositoryName: string; choices: readonly LinkWorkspaceChoice[]; finish: (path: string | undefined) => void }) {
  const [picked, setPicked] = useState(choices[0]?.path ?? null);
  const cards = choices.map((choice) => ({ value: choice.path, title: choice.name, description: choice.on ? `${choice.on} · ${choice.path}` : choice.path }));
  return (
    <Dialog
      title="Open in which workspace?"
      description={`More than one of your workspaces is on ${repositoryName}.`}
      onClose={() => finish(undefined)}
      onSubmit={() => finish(picked ?? undefined)}
      footer={
        <>
          <Button onClick={() => finish(undefined)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!picked} autoFocus>
            Open
          </Button>
        </>
      }
    >
      <OptionCards label="Workspaces" cards={cards} value={picked} onChange={setPicked} />
    </Dialog>
  );
}
