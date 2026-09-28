import * as migration_20260928_123901_initial from "./20260928_123901_initial";

export const migrations = [
  {
    up: migration_20260928_123901_initial.up,
    down: migration_20260928_123901_initial.down,
    name: "20260928_123901_initial",
  },
];
