import type { Period } from "@/admin/reports/period";
import { PeriodFields } from "@/admin/reports/ui";
import { counted } from "@/components/ops/charts/scale";
import { Ring } from "@/components/ops/charts/ring";
import { TipLayer } from "@/components/ops/charts/tip-layer";
import { FilterForm } from "@/components/ops/filter-form";
import { Panel } from "@/components/ops/primitives";
import type { FinanceOverview } from "@/domain/finance/overview";
import { formatPence, type Pence } from "@/domain/money";

const money = (pence: number) => formatPence(pence as Pence);
const share = (part: number, whole: number) => (whole > 0 ? part / whole : null);

/**
 * The accounts overview (approved by Cityline, 6 Oct 2026): three rings for
 * the bookings picked up in the chosen dates — how much of what drivers
 * earned is paid, how much of what partners owe has come in, and the profit
 * with its margin. Owner and Accounts.
 */
export function FinanceRings({
  overview,
  period,
  action,
}: {
  overview: FinanceOverview;
  period: Period;
  action: string;
}) {
  const { drivers, suppliers, profit } = overview;
  return (
    <Panel
      title="Money in and out"
      description={`Bookings picked up ${period.label}. Test bookings are never counted.`}
    >
      <FilterForm
        action={action}
        className="mb-5 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3"
      >
        <PeriodFields period={period} />
      </FilterForm>
      <TipLayer className="grid gap-6 md:grid-cols-3">
        <Ring
          label="Paid to drivers"
          value={money(drivers.paidPence)}
          share={share(drivers.paidPence, drivers.earnedPence)}
          caption={
            <>
              of {money(drivers.earnedPence)} drivers earned
              {drivers.unpriced
                ? ` · ${counted(drivers.unpriced, "booking")} with no driver price yet`
                : ""}
            </>
          }
          tip={`${money(drivers.paidPence)} paid of ${money(drivers.earnedPence)} earned`}
        />
        <Ring
          label="Got from suppliers"
          value={money(suppliers.receivedPence)}
          share={share(suppliers.receivedPence, suppliers.owedPence)}
          caption={`of ${money(suppliers.owedPence)} partners owe for these bookings`}
          tip={`${money(suppliers.receivedPence)} received of ${money(suppliers.owedPence)} owed`}
        />
        <Ring
          label={profit.profitPence < 0 ? "Loss" : "Profit"}
          value={money(profit.profitPence)}
          share={profit.margin}
          tone={profit.profitPence < 0 ? "danger" : undefined}
          caption={`${money(profit.incomePence)} in, less ${money(profit.driverPence)} drivers, ${money(profit.feesPence)} card fees and ${money(profit.expensesPence)} expenses`}
          tip="Margin: profit as a share of what the bookings earned"
        />
      </TipLayer>
      <p className="text-ink-3 mt-4 text-xs">
        Profit is booking prices less driver prices, Stripe&apos;s card fees and
        Cityline&apos;s own expenses in these dates.
      </p>
    </Panel>
  );
}
