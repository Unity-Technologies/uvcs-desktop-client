/**
 * The Cancel of a running operation: the first press asks it to stop and turns the button into "Stopping…"; pressing
 * again while it winds down asks nothing more.
 */
export function stopOnce(requestStop: () => void, showStopping: () => void): () => void {
  let requested = false;
  return () => {
    if (requested) return;
    requested = true;
    requestStop();
    showStopping();
  };
}
