/**
 * The shape of a one-path SVG icon, as the icon packages ship them (`<svg …><path d="…"/></svg>`), for a component
 * that draws it on its own `<svg>`. Fails on an icon of another shape: drawing nothing would go unnoticed.
 */
export function svgPathOf(svg: string): string {
  const paths = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)];
  if (paths.length !== 1) throw new Error(`An icon of one path was expected, found ${paths.length}`);
  return paths[0]![1]!;
}
