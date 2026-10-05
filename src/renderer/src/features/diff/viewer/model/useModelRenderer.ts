import { useEffect, useState, type RefObject } from 'react';
import { ModelRenderer } from './modelRenderer';

/** The renderer of a canvas, for as long as it is mounted, sized to it at the screen's pixel ratio. */
export function useModelRenderer(canvasRef: RefObject<HTMLCanvasElement | null>): ModelRenderer | null {
  const [renderer, setRenderer] = useState<ModelRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const created = new ModelRenderer(canvas);
    const resize = (): void => created.setSize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    setRenderer(created);
    return () => {
      observer.disconnect();
      created.dispose();
      setRenderer(null);
    };
  }, [canvasRef]);

  return renderer;
}
