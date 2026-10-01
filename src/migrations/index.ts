import * as migration_20260928_123901_initial from "./20260928_123901_initial";
import * as migration_20260928_175436_checkout_session_and_job_sequence from "./20260928_175436_checkout_session_and_job_sequence";
import * as migration_20260930_221901_fleet_compliance_suppliers from "./20260930_221901_fleet_compliance_suppliers";
import * as migration_20260930_235218_dispatch_and_messages from "./20260930_235218_dispatch_and_messages";

export const migrations = [
  {
    up: migration_20260928_123901_initial.up,
    down: migration_20260928_123901_initial.down,
    name: "20260928_123901_initial",
  },
  {
    up: migration_20260928_175436_checkout_session_and_job_sequence.up,
    down: migration_20260928_175436_checkout_session_and_job_sequence.down,
    name: "20260928_175436_checkout_session_and_job_sequence",
  },
  {
    up: migration_20260930_221901_fleet_compliance_suppliers.up,
    down: migration_20260930_221901_fleet_compliance_suppliers.down,
    name: "20260930_221901_fleet_compliance_suppliers",
  },
  {
    up: migration_20260930_235218_dispatch_and_messages.up,
    down: migration_20260930_235218_dispatch_and_messages.down,
    name: "20260930_235218_dispatch_and_messages",
  },
];
