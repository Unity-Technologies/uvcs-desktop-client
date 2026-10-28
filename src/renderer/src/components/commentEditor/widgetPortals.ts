import type { ReactNode } from 'react';

/**
 * What the editor's widgets (a chip, a table) show, rendered by React into the element CodeMirror gave each: a portal
 * keeps the app's context (the place, its queries), so a chip in the editor is the very `ReferenceChip` a shown
 * comment draws. The editor's component renders them (`useSyncExternalStore`).
 */
export class WidgetPortals {
  private readonly shown = new Map<HTMLElement, { key: number; node: ReactNode }>();
  private readonly listeners = new Set<() => void>();
  private snapshot: readonly WidgetPortal[] = [];
  private nextKey = 0;

  show(host: HTMLElement, node: ReactNode): void {
    this.shown.set(host, { key: this.shown.get(host)?.key ?? this.nextKey++, node });
    this.changed();
  }

  remove(host: HTMLElement): void {
    if (this.shown.delete(host)) this.changed();
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly portals = (): readonly WidgetPortal[] => this.snapshot;

  private changed(): void {
    this.snapshot = [...this.shown].map(([host, { key, node }]) => ({ host, key, node }));
    for (const listener of this.listeners) listener();
  }
}

export interface WidgetPortal {
  host: HTMLElement;
  key: number;
  node: ReactNode;
}
