import { useEffect, useState, type RefObject } from 'react';
import { ModelRenderer } from './modelRenderer';

/**
 * A renderer on a canvas of its own, put in the host element for as long as it is mounted, sized to it at the screen's
 * pixel ratio. Each renderer gets a new canvas, never one a disposed renderer drew on: `ModelRenderer.dispose` loses
 * the canvas's WebGL context for good, and the canvas would hand that lost context to the next renderer, which three
 * can't start on ("Cannot read properties of null (reading 'precision')"). StrictMode's second mount did just that.
 */
export function useModelRenderer(hostRef: RefObject<HTMLElement | null>): ModelRenderer | null {
  const [renderer, setRenderer] = useState<ModelRenderer | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = host.appendChild(document.createElement('canvas'));
    const created = new ModelRenderer(canvas);
    const resize = (): void => created.setSize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    setRenderer(created);
    return () => {
      observer.disconnect();
      created.dispose();
      canvas.remove();
      setRenderer(null);
    };
  }, [hostRef]);

  return renderer;
}
