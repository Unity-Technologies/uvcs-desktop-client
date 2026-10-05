import { useEffect, useState, type RefObject } from 'react';
import { pierreShadowRoot } from './pierreDom';

/**
 * The shadow root of the diff in `containerRef` (`pierreShadowRoot`), as state: effects that reach into the diff
 * depend on it, so they start once it's there. It isn't on a diff's first render: the diff shows once its language
 * can be highlighted (the first time a language shows up), and Pierre renders its element after that. Pierre may also
 * render the diff anew in another element (another comparison method), with another root.
 */
export function useDiffShadowRoot(containerRef: RefObject<HTMLElement | null>): ShadowRoot | null {
  const [root, setRoot] = useState<ShadowRoot | null>(null);

  // After every render: the container itself may have only just appeared.
  useEffect(() => {
    const container = containerRef.current;
    const found = pierreShadowRoot(container);
    if (found !== root) setRoot(found);
    if (found || !container) return;
    // Pierre renders its element in a render of its own, which this component may not see.
    const appearing = new MutationObserver(() => setRoot(pierreShadowRoot(container)));
    appearing.observe(container, { childList: true, subtree: true });
    return () => appearing.disconnect();
  });

  return root;
}
