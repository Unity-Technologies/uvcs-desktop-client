import { useEffect, useState, type RefObject } from 'react';
import { ModelRenderer } from './modelRenderer';

export interface ModelRendererState {
  /** `null` until mounted, and where WebGL can't start. */
  renderer: ModelRenderer | null;
  /** WebGL couldn't start here (no usable GPU, or the browser's limit of contexts reached): the viewer says so. */
  unavailable: boolean;
}

/**
 * A renderer on a canvas of its own, put in the host element for as long as it is mounted, sized to it at the screen's
 * pixel ratio. Each renderer gets a new canvas, never one a disposed renderer drew on: `ModelRenderer.dispose` loses
 * the canvas's WebGL context for good, and the canvas would hand that lost context to the next renderer, which three
 * can't start on ("Cannot read properties of null (reading 'precision')"). StrictMode's second mount did just that.
 */
export function useModelRenderer(hostRef: RefObject<HTMLElement | null>): ModelRendererState {
  const [state, setState] = useState<ModelRendererState>({ renderer: null, unavailable: false });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = host.appendChild(document.createElement('canvas'));
    const created = startRenderer(canvas);
    if (!created) {
      canvas.remove();
      setState({ renderer: null, unavailable: true });
      return;
    }
    const resize = (): void => created.setSize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    setState({ renderer: created, unavailable: false });
    return () => {
      observer.disconnect();
      created.dispose();
      canvas.remove();
      setState({ renderer: null, unavailable: false });
    };
  }, [hostRef]);

  return state;
}

/** The renderer, or `null` where three can't start WebGL on the canvas: it throws, and would take the window with it. */
function startRenderer(canvas: HTMLCanvasElement): ModelRenderer | null {
  try {
    return new ModelRenderer(canvas, { picks: true });
  } catch (error) {
    console.warn("The 3D view couldn't start WebGL:", error);
    return null;
  }
}
