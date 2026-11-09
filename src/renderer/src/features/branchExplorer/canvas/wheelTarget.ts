/**
 * Where a wheel or trackpad event goes in the Branch Explorer: a caption card's comment scrolls under the pointer, as
 * its body scrolls past the canvas's bottom (`captionCardMaxHeight`); everywhere else, and for a zoom anywhere, the
 * graph takes it (`wheelGesture`), so the page itself never zooms.
 */
export function wheelGoesTo(event: { inCaptionCard: boolean; zoom: boolean }): 'card' | 'graph' {
  return event.inCaptionCard && !event.zoom ? 'card' : 'graph';
}
