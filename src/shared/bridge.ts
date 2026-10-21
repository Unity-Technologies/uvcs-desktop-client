import type { UvcsEventName, UvcsEvents } from './events';
import type { InvokeRequest, InvokeResponse } from './ipc';

/**
 * What the preload script exposes to the renderer as `window.uvcs`: the one invoke channel and the events, and besides
 * them only values the page needs synchronously before its first frame. No other capability or channel.
 */
export interface UvcsBridge {
  invoke(request: InvokeRequest): Promise<InvokeResponse>;
  on<Name extends UvcsEventName>(name: Name, listener: (payload: UvcsEvents[Name]) => void): () => void;
  platform: string;
  /**
   * The page's zoom factor as it starts (1 at 100%; Chromium restores the one its origin was left at), read before its
   * first frame; later changes come as `pageZoomChanged`.
   */
  initialZoom: number;
  /** The file-system path of a file or folder dropped onto the window. */
  pathForFile(file: File): string;
}
