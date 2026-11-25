import type { LinkProblem } from '@shared/links/parseLink';

/** Why a link couldn't open, as its dialog says it. */
export type LinkFailure =
  | LinkProblem
  | { kind: 'notInWorkspace'; folder: string }
  | { kind: 'notFound'; what: string; repository: string };

export interface LinkProblemWords {
  title: string;
  message: string;
  /** A link naming what this version doesn't know: the dialog offers to check for updates, in case a newer one does. */
  offersUpdate: boolean;
}

export function linkProblemWords(failure: LinkFailure): LinkProblemWords {
  switch (failure.kind) {
    case 'notALink':
      return { title: "This isn't a link", message: 'Links start with uvcs://.', offersUpdate: false };
    case 'malformed':
      return { title: "This link can't be opened", message: failure.detail, offersUpdate: false };
    case 'unknown':
      return { title: "This link isn't supported", message: "This version of the app can't open this link.", offersUpdate: true };
    case 'notInWorkspace':
      return { title: 'No workspace holds this folder', message: failure.folder, offersUpdate: false };
    case 'notFound':
      return { title: `${capitalized(failure.what)} isn't in ${failure.repository}`, message: 'It may have been deleted or renamed.', offersUpdate: false };
  }
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
