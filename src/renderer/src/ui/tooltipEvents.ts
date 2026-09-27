interface TooltipHandlers {
  move: (event: MouseEvent) => void;
  over: (event: MouseEvent) => void;
  hide: () => void;
}

const CAPTURE = { capture: true };

/**
 * Wires the tooltip layer to the page and returns the unwiring. A press hides the tooltip on `pointerdown`, not
 * `mousedown`: menu and popover triggers open on pointerdown and cancel it, which keeps mousedown from firing, so the
 * trigger's tooltip would stay over the menu it opened. A key hides it too (Enter or Space opening a menu, a shortcut).
 */
export function listenForTooltips(page: { document: EventTarget; window: EventTarget }, { move, over, hide }: TooltipHandlers): () => void {
  const onMove = move as EventListener;
  const onOver = over as EventListener;
  page.document.addEventListener('mousemove', onMove);
  page.document.addEventListener('mouseover', onOver);
  page.document.addEventListener('pointerdown', hide, CAPTURE);
  page.document.addEventListener('keydown', hide, CAPTURE);
  page.window.addEventListener('scroll', hide, CAPTURE);
  page.window.addEventListener('blur', hide);
  return () => {
    page.document.removeEventListener('mousemove', onMove);
    page.document.removeEventListener('mouseover', onOver);
    page.document.removeEventListener('pointerdown', hide, CAPTURE);
    page.document.removeEventListener('keydown', hide, CAPTURE);
    page.window.removeEventListener('scroll', hide, CAPTURE);
    page.window.removeEventListener('blur', hide);
  };
}
