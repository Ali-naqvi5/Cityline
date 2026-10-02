import { Download } from "lucide-react";
import type { ReactNode } from "react";

import { Label, Select, TextInput } from "@/components/ops/form-controls";
import { buttonClass } from "@/components/ops/primitives";

import { PERIOD_LABELS, type Period, type PeriodKey } from "./period";

/**
 * Pieces every report shares, so they all look and behave alike: the period
 * fields at the front of the filter row, the line saying what is covered and
 * what it is compared with, and the download of the raw rows.
 */

/** The filter row: as many fields to a line as fit, never squeezed. */
export const FILTER_GRID =
  "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-4";

const PRESETS = (Object.keys(PERIOD_LABELS) as PeriodKey[]).filter(
  (key) => key !== "custom",
);

/** Period list plus from/to dates. A date makes it "Chosen dates"; a preset clears the dates. */
export function PeriodFields({ period }: { period: Period }) {
  const custom = period.key === "custom";
  return (
    <>
      <div>
        <Label htmlFor="report-period">Period</Label>
        <Select
          id="report-period"
          name="period"
          defaultValue={period.key}
          data-clear="from,to"
        >
          {PRESETS.map((key) => (
            <option key={key} value={key}>
              {PERIOD_LABELS[key]}
            </option>
          ))}
          <option value="custom">{PERIOD_LABELS.custom}</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="report-from">From</Label>
        <TextInput
          id="report-from"
          name="from"
          type="date"
          defaultValue={custom ? period.from : ""}
          data-set="period=custom"
        />
      </div>
      <div>
        <Label htmlFor="report-to">To</Label>
        <TextInput
          id="report-to"
          name="to"
          type="date"
          defaultValue={custom ? period.to : ""}
          data-set="period=custom"
        />
      </div>
    </>
  );
}

export function PeriodLine({ period, basis }: { period: Period; basis: string }) {
  return (
    <p className="text-ink-3 mb-4 text-sm">
      <span className="text-ink font-medium">{period.label}</span> · {basis} · compared
      with {period.previous.name} ({period.previous.label})
    </p>
  );
}

export function DownloadCsv({
  href,
  children = "Download CSV",
}: {
  href: string;
  children?: ReactNode;
}) {
  return (
    <a href={href} className={buttonClass("secondary", "md")} download>
      <Download aria-hidden className="h-4 w-4" />
      {children}
    </a>
  );
}
