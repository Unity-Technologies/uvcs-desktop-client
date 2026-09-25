import type { UvcsEventName, UvcsEvents } from './events';
import type { InvokeRequest, InvokeResponse } from './ipc';

/** What the preload script exposes to the renderer as `window.uvcs`. */
export interface UvcsBridge {
  invoke(request: InvokeRequest): Promise<InvokeResponse>;
  on<Name extends UvcsEventName>(name: Name, listener: (payload: UvcsEvents[Name]) => void): () => void;
  platform: string;
}
