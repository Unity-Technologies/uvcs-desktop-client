import { appBundleOf } from './appBundle';

/** The OS's picture of a file or app as a data URL; undefined when it has none. */
export type ReadImage = (path: string) => Promise<string | undefined>;

/** The two ways the OS draws a path: its thumbnail (`nativeImage.createThumbnailFromPath`), or its icon (`app.getFileIcon`). */
export interface IconReaders {
  thumbnail: ReadImage;
  fileIcon: ReadImage;
}

/**
 * Apps' own icons, for the editors, terminals and merge tools offered (macOS and Windows), each read once. Each OS draws
 * an app's icon a different way: macOS as the thumbnail of its bundle (its file icon is the file type's, every app the
 * same); Windows as the program's file icon, the one Explorer shows (it has no thumbnail for a program: the thumbnail
 * cache fails). A program inside a macOS bundle shows the bundle's; a Windows `.cmd` launcher and a Linux desktop entry
 * have only a file's picture, so they show none.
 */
export class AppIcons {
  private readonly read = new Map<string, Promise<string | undefined>>();

  constructor(
    private readonly platform: NodeJS.Platform,
    private readonly readers: IconReaders,
  ) {}

  /** The icon of the app `program` (a bundle, a program, or a program inside a bundle) is. */
  of(program: string): Promise<string | undefined> {
    const location = this.iconLocation(program);
    if (!location) return Promise.resolve(undefined);
    let icon = this.read.get(location);
    if (!icon) {
      const readImage = this.platform === 'win32' ? this.readers.fileIcon : this.readers.thumbnail;
      icon = readImage(location).catch(() => undefined);
      this.read.set(location, icon);
    }
    return icon;
  }

  /** `item` with the icon of its app, when there is one. */
  async withIcon<T extends { icon?: string }>(item: T, program: string): Promise<T> {
    const icon = await this.of(program);
    return icon ? { ...item, icon } : item;
  }

  private iconLocation(program: string): string | undefined {
    if (this.platform === 'darwin') return appBundleOf(program) ?? program;
    if (this.platform === 'win32') return /\.(cmd|bat)$/i.test(program) ? undefined : program;
    return undefined;
  }
}
