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
import * as migration_20261006_000549_supplier_money from "./20261006_000549_supplier_money";
import * as migration_20261006_014359_expenses from "./20261006_014359_expenses";
import * as migration_20261006_095524_payments_and_refunds from "./20261006_095524_payments_and_refunds";
import * as migration_20261008_203544_outsourced_drivers from "./20261008_203544_outsourced_drivers";
import * as migration_20261009_224314_green_vehicle_class from "./20261009_224314_green_vehicle_class";
import * as migration_20261010_000823_outsourced_phv_number from "./20261010_000823_outsourced_phv_number";
import * as migration_20261013_021613_driver_payment_receipt from "./20261013_021613_driver_payment_receipt";
import * as migration_20261014_153546_driver_payment_period from "./20261014_153546_driver_payment_period";
import * as migration_20261015_161905_subcontracting_operators from "./20261015_161905_subcontracting_operators";

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
  {
    up: migration_20261006_000549_supplier_money.up,
    down: migration_20261006_000549_supplier_money.down,
    name: "20261006_000549_supplier_money",
  },
  {
    up: migration_20261006_014359_expenses.up,
    down: migration_20261006_014359_expenses.down,
    name: "20261006_014359_expenses",
  },
  {
    up: migration_20261006_095524_payments_and_refunds.up,
    down: migration_20261006_095524_payments_and_refunds.down,
    name: "20261006_095524_payments_and_refunds",
  },
  {
    up: migration_20261008_203544_outsourced_drivers.up,
    down: migration_20261008_203544_outsourced_drivers.down,
    name: "20261008_203544_outsourced_drivers",
  },
  {
    up: migration_20261009_224314_green_vehicle_class.up,
    down: migration_20261009_224314_green_vehicle_class.down,
    name: "20261009_224314_green_vehicle_class",
  },
  {
    up: migration_20261010_000823_outsourced_phv_number.up,
    down: migration_20261010_000823_outsourced_phv_number.down,
    name: "20261010_000823_outsourced_phv_number",
  },
  {
    up: migration_20261013_021613_driver_payment_receipt.up,
    down: migration_20261013_021613_driver_payment_receipt.down,
    name: "20261013_021613_driver_payment_receipt",
  },
  {
    up: migration_20261014_153546_driver_payment_period.up,
    down: migration_20261014_153546_driver_payment_period.down,
    name: "20261014_153546_driver_payment_period",
  },
  {
    up: migration_20261015_161905_subcontracting_operators.up,
    down: migration_20261015_161905_subcontracting_operators.down,
    name: "20261015_161905_subcontracting_operators",
  },
];
