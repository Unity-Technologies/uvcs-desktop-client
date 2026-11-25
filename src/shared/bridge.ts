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
  /** The file-system path of a file or folder dropped onto the window. */
  pathForFile(file: File): string;
}
