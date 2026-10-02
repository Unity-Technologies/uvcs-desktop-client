import { normalize } from 'node:path';
import { dialog, nativeImage } from 'electron';
import type { AppsApi } from '@shared/api/apps';
import type { ExternalApp, ExternalApps } from '@shared/domain/externalApps';
import type { AppsContext } from './ServiceContext';

/** Drawn at 14-18 px; twice that for high-density screens. */
const ICON_SIZE = { width: 36, height: 36 };

export function createAppsService({ apps }: AppsContext, platform: NodeJS.Platform = process.platform): AppsApi {
  const icons = new Map<string, Promise<string | undefined>>();

  /**
   * Each app's own icon, read once per location: the OS's thumbnail of an app bundle or a program is its icon
   * (`app.getFileIcon` draws the icon of its file type instead: every macOS app the same). Linux makes no thumbnails, and
   * a desktop entry has no icon of its own but a file's, so its apps show none.
   */
  function iconOf(location: string): Promise<string | undefined> {
    if (platform === 'linux') return Promise.resolve(undefined);
    let icon = icons.get(location);
    if (!icon) {
      icon = nativeImage.createThumbnailFromPath(location, ICON_SIZE).then(
        (image) => (image.isEmpty() ? undefined : image.toDataURL()),
        () => undefined,
      );
      icons.set(location, icon);
    }
    return icon;
  }

  const withIcon = async (external: ExternalApp): Promise<ExternalApp> => {
    const icon = await iconOf(external.location);
    return icon ? { ...external, icon } : external;
  };

  return {
    list: async (): Promise<ExternalApps> => {
      const list = await apps.list();
      const [editors, terminals] = await Promise.all([Promise.all(list.editors.map(withIcon)), Promise.all(list.terminals.map(withIcon))]);
      return { ...list, editors, terminals };
    },
    // In the OS's own separators, as every app expects them.
    openInEditor: (path, editorId) => apps.openInEditor(normalize(path), editorId),
    openInTerminal: (folder, terminalId) => apps.openInTerminal(normalize(folder), terminalId),
    pickProgram: async () => {
      // A macOS app is kept as its bundle, opened the way Finder opens it (`open -a`).
      const result = await dialog.showOpenDialog({
        title: 'Choose an app',
        defaultPath: platform === 'darwin' ? '/Applications' : undefined,
        properties: ['openFile'],
      });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
  };
}
