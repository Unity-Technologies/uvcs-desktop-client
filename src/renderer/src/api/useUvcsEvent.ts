import { useEffect, useRef } from 'react';
import type { UvcsEventName, UvcsEvents } from '@shared/events';

export function useUvcsEvent<Name extends UvcsEventName>(name: Name, listener: (payload: UvcsEvents[Name]) => void): void {
  const latestListener = useRef(listener);
  latestListener.current = listener;

  useEffect(() => window.uvcs.on(name, (payload) => latestListener.current(payload)), [name]);
}
