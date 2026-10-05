import * as migration_20260928_123901_initial from "./20260928_123901_initial";
import * as migration_20260928_175436_checkout_session_and_job_sequence from "./20260928_175436_checkout_session_and_job_sequence";
import * as migration_20260930_221901_fleet_compliance_suppliers from "./20260930_221901_fleet_compliance_suppliers";
import * as migration_20260930_235218_dispatch_and_messages from "./20260930_235218_dispatch_and_messages";
import * as migration_20261001_194400_booking_driver_price from "./20261001_194400_booking_driver_price";
import * as migration_20261001_213424_job_cycle_stages from "./20261001_213424_job_cycle_stages";
import * as migration_20261001_224224_staff_theme from "./20261001_224224_staff_theme";
import * as migration_20261001_224828_customers_section from "./20261001_224828_customers_section";
import * as migration_20261005_143956_driver_records_and_taken_off from "./20261005_143956_driver_records_and_taken_off";
import * as migration_20261005_231423_driver_payments from "./20261005_231423_driver_payments";

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
  {
    up: migration_20261001_194400_booking_driver_price.up,
    down: migration_20261001_194400_booking_driver_price.down,
    name: "20261001_194400_booking_driver_price",
  },
  {
    up: migration_20261001_213424_job_cycle_stages.up,
    down: migration_20261001_213424_job_cycle_stages.down,
    name: "20261001_213424_job_cycle_stages",
  },
  {
    up: migration_20261001_224224_staff_theme.up,
    down: migration_20261001_224224_staff_theme.down,
    name: "20261001_224224_staff_theme",
  },
  {
    up: migration_20261001_224828_customers_section.up,
    down: migration_20261001_224828_customers_section.down,
    name: "20261001_224828_customers_section",
  },
  {
    up: migration_20261005_143956_driver_records_and_taken_off.up,
    down: migration_20261005_143956_driver_records_and_taken_off.down,
    name: "20261005_143956_driver_records_and_taken_off",
  },
  {
    up: migration_20261005_231423_driver_payments.up,
    down: migration_20261005_231423_driver_payments.down,
    name: "20261005_231423_driver_payments",
  },
];
