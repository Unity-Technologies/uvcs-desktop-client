import type { RepositoryVersion } from '@shared/domain/content';
import { navigation } from '../app/navigation/navigationStore';
import type { PageOf } from '../app/navigation/pages';
import { openVersion, saveVersionAs } from '../features/history/revisionOperations';
import type { MenuEntry } from '../lib/actions';
import { groupedMenu, type GroupedEntry } from '../lib/menuGroups';
import { fileNameOf } from '../lib/text';
import { copySubmenu, type CopyTexts } from './copyMenu';
import { openRevisionEntries } from './externalApps/openWithMenu';
import { menuAction } from './menuWords';

/** A changed file as its menu needs it, wherever a list of changed files shows it: a diff, Incoming, a merge. */
export interface ChangedFile {
  /** As the list shows it; what Copy copies. */
  path: string;
  /** Its history, from where it is on this side; none where the file has none to show. */
  history: PageOf<'history'> | null;
  /** Its history with this side's version annotated; none for what can't be annotated (a folder, a deleted file). */
  annotation: PageOf<'history'> | null;
  /** The version "Open this revision" and "Save this revision as…" take out of the repository; none for a deleted file or a folder. */
  version: RepositoryVersion | null;
  /** The link to the file there (a diff's file: docs/features/deep-links.md); none where the list has none to share (a merge). */
  link?: CopyTexts['link'];
}

/**
 * The menu of any list of changed files: what the list adds (`added`: a review mark, a conflict's choices), the file's
 * history (annotated or not), opening or saving its version, and Copy. Nothing is read to build it: each entry reads
 * what it needs when it runs.
 */
export function changedFileMenu(workspacePath: string, files: ChangedFile[], added: (GroupedEntry | null)[] = []): MenuEntry[] {
  const single = files.length === 1 ? files[0]! : null;
  const version = single?.version;
  // What the list adds goes after the shared entries of its group, so every list reads the same with its own at the end.
  return groupedMenu([
    single?.history && menuAction('history', () => navigation.openPage(single.history!)),
    single?.annotation && menuAction('annotate', () => navigation.openPage(single.annotation!)),
    ...(version ? openRevisionEntries((editorId) => openVersion(workspacePath, version, fileNameOf(single.path), editorId)) : []),
    version && menuAction('saveAs', () => void saveVersionAs(workspacePath, version, fileNameOf(single!.path))),
    copySubmenu('', { path: files.map((file) => file.path).join('\n'), link: single?.link }, { count: files.length }),
    ...added,
  ]);
}
