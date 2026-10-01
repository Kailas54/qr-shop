const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Parses JWT-style durations such as 15m, 7d, 1h. */
export function parseDurationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }
  const amount = Number(match[1]);
  const unit = UNIT_MS[match[2]];
  if (!Number.isFinite(amount) || amount <= 0 || unit === undefined) {
    throw new Error(`Invalid duration: ${value}`);
  }
  return amount * unit;
}
