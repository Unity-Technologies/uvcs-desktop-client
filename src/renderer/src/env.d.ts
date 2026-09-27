/// <reference types="vite/types/importMeta.d.ts" />
import type { UvcsBridge } from '@shared/bridge';

declare global {
  interface Window {
    uvcs: UvcsBridge;
  }
}
