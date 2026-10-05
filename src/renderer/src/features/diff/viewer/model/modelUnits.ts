// Lengths and units as a Unity user reads them: metres for a building, centimetres for a prop, millimetres for a
// pivot nudge; a file's units by the name its exporter gives them.

/** A length in metres, in the unit that keeps it readable: 180 m, 1.8 m, 45 cm, 5 mm. */
export function formatLength(metres: number): string {
  const size = Math.abs(metres);
  if (size >= 1) return `${trimmed(metres, size >= 100 ? 0 : size >= 10 ? 1 : 2)} m`;
  if (size >= 0.01) return `${trimmed(metres * 100, size >= 0.1 ? 0 : 1)} cm`;
  return `${trimmed(metres * 1000, size >= 0.001 ? 0 : 2)} mm`;
}

/** Metres per file unit (`ParsedModel.unitScale`) as the unit's name. */
export function formatUnits(unitScale: number): string {
  const named: [number, string][] = [
    [1, 'metres'],
    [0.01, 'centimetres'],
    [0.001, 'millimetres'],
    [0.0254, 'inches'],
    [0.3048, 'feet'],
    [1000, 'kilometres'],
  ];
  const match = named.find(([scale]) => Math.abs(unitScale / scale - 1) < 1e-6);
  return match ? match[1] : `${formatLength(unitScale)} units`;
}

function trimmed(value: number, decimals: number): string {
  return String(Number(value.toFixed(decimals)));
}
