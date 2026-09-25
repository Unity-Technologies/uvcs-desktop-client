const UNITS: Record<string, number> = {
  bytes: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
};

/** A size as `cm` prints it ("55.68", "MB"; "55,68" in cultures with a decimal comma), in bytes; undefined if unknown. */
export function parseSize(amount: string, unit: string): number | undefined {
  const factor = UNITS[unit];
  const value = Number(amount.replace(',', '.'));
  return factor === undefined || Number.isNaN(value) ? undefined : Math.round(value * factor);
}
