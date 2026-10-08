"use client";

import { AlertTriangle, Ban, CheckCircle2, Search, UserCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { assignDriverAction } from "@/admin/actions/dispatch";
import type { BoardCar, BoardDriver } from "@/admin/data/dispatch";
import { EMPTY_FORM } from "@/admin/form-state";
import {
  FormMessage,
  inputClass,
  invalid,
  SubmitButton,
  submitWith,
  TEXTAREA_CLASS,
} from "@/components/ops/form";
import { Badge, buttonClass, cx } from "@/components/ops/primitives";
import { SearchSelect } from "@/components/ops/search-select";
import { fitWarnings } from "@/domain/dispatch/eligibility";
import { rankMatches } from "@/domain/dispatch/search";
import { vehicleClassName } from "@/domain/jobs/labels";

interface Row {
  key: string;
  driver: BoardDriver | null;
  car: BoardCar | null;
}

interface Verdict {
  blocks: string[];
  warnings: string[];
}

const carText = (car: BoardCar) =>
  `${car.colour} ${car.make} ${car.model} · ${vehicleClassName(car.vehicleClassSlug)}${car.seats ? ` · ${car.seats} seats` : ""}`;

/**
 * Choosing who does a job (spec §19; Cityline, 9 Oct 2026): every driver and
 * every car, found with one search — a name, a registration, a model — and
 * any driver may take any car. What only warns is shown; what the law
 * forbids (a licence, MOT or insurance missing or out of date; a suspended
 * driver; a car off the road) stops the assignment, and the server checks
 * again when it saves.
 *
 * Giving the job to someone else takes the current driver off it, so the
 * reason is asked for — it goes on the job's history and the Driver Report.
 */
export function AssignForm({
  jobId,
  job,
  drivers,
  cars,
  current,
  notifyPassenger,
  canEmailPassenger,
  passengerEmails,
  cancelHref,
  driverPricePence,
}: {
  jobId: number;
  job: { jobClass: string; passengers: number | null };
  drivers: BoardDriver[];
  cars: BoardCar[];
  /** The driver and car on the job now, if any. */
  current: { driverId: number; carId: number | null; name: string } | null;
  notifyPassenger: boolean;
  canEmailPassenger: boolean;
  /** Whether driver details are emailed to passengers at all. */
  passengerEmails: boolean;
  cancelHref: string;
  driverPricePence: number | null;
}) {
  const [state, action, pending] = useActionState(assignDriverAction, EMPTY_FORM);
  const [query, setQuery] = useState("");
  const [driverId, setDriverId] = useState(current ? String(current.driverId) : "");
  const [carId, setCarId] = useState(current?.carId ? String(current.carId) : "");

  const driverById = useMemo(
    () => new Map(drivers.map((d) => [String(d.id), d])),
    [drivers],
  );
  const carById = useMemo(() => new Map(cars.map((c) => [String(c.id), c])), [cars]);

  const verdict = (driver: BoardDriver | null, car: BoardCar | null): Verdict => ({
    blocks: [...(driver?.blocks ?? []), ...(car?.blocks ?? [])],
    warnings: [
      ...(car
        ? fitWarnings(job, car, driver ? car.driverIds.includes(driver.id) : undefined)
        : []),
      ...(driver?.warnings ?? []),
      ...(car?.warnings ?? []),
    ],
  });

  // Every driver with each car they use; a driver with none; a car nobody uses.
  const rows = useMemo<Row[]>(() => {
    const listed = new Set<number>();
    const out: Row[] = [];
    for (const driver of drivers) {
      const own = driver.carIds
        .map((id) => carById.get(String(id)))
        .filter((car): car is BoardCar => Boolean(car));
      if (own.length === 0) out.push({ key: `${driver.id}:`, driver, car: null });
      for (const car of own) {
        listed.add(car.id);
        out.push({ key: `${driver.id}:${car.id}`, driver, car });
      }
    }
    for (const car of cars) {
      if (!listed.has(car.id)) out.push({ key: `:${car.id}`, driver: null, car });
    }
    return out;
  }, [drivers, cars, carById]);

  const shown = useMemo(() => {
    const ranked = rankMatches(rows, query, (row) => [
      row.driver?.name ?? "",
      row.driver?.phone ?? "",
      row.car?.registration ?? "",
      row.car?.make ?? "",
      row.car?.model ?? "",
      row.car ? `${row.car.make} ${row.car.model}` : "",
      row.car?.colour ?? "",
      row.car ? vehicleClassName(row.car.vehicleClassSlug) : "",
    ]);
    if (query.trim()) return ranked;
    // With nothing typed: the current pair, then who can go, fewest warnings first.
    const isCurrent = (row: Row) =>
      current !== null &&
      row.driver?.id === current.driverId &&
      row.car?.id === current.carId;
    return ranked
      .map((row) => ({ row, v: verdict(row.driver, row.car) }))
      .sort(
        (a, b) =>
          Number(isCurrent(b.row)) - Number(isCurrent(a.row)) ||
          Number(a.v.blocks.length > 0 || !a.row.driver || !a.row.car) -
            Number(b.v.blocks.length > 0 || !b.row.driver || !b.row.car) ||
          a.v.warnings.length - b.v.warnings.length,
      )
      .map(({ row }) => row);
    // `verdict` reads only props, which these dependencies cover.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, current]);

  const driver = driverById.get(driverId) ?? null;
  const car = carById.get(carId) ?? null;
  const chosen = verdict(driver, car);
  const ready = driver !== null && car !== null && chosen.blocks.length === 0;
  const replacing = current !== null && driver !== null && driver.id !== current.driverId;

  const choose = (row: Row) => {
    if (row.driver) setDriverId(String(row.driver.id));
    if (row.car) setCarId(String(row.car.id));
    else if (row.driver) setCarId("");
  };

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-4">
      <input type="hidden" name="jobId" value={jobId} />
      <input
        type="hidden"
        name="pair"
        value={driver && car ? `${driver.id}:${car.id}` : ""}
      />

      <div>
        <label htmlFor="assign-search" className="sr-only">
          Search drivers and cars
        </label>
        <div className="relative">
          <Search
            aria-hidden
            className="text-ink-4 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          />
          <input
            id="assign-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a driver or car — name, registration or model"
            autoComplete="off"
            className={inputClass("pl-9")}
          />
        </div>
        <p className="text-ink-3 mt-1 text-xs">
          {query.trim()
            ? `${shown.length} ${shown.length === 1 ? "match" : "matches"}, closest first`
            : `${drivers.length} drivers and ${cars.length} cars`}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="text-ink-3 border-line rounded-md border border-dashed p-4 text-sm">
          No driver or car matches “{query}”.
        </p>
      ) : (
        <ul
          className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1"
          aria-label="Drivers and cars"
        >
          {shown.map((row) => {
            const v = verdict(row.driver, row.car);
            const active =
              row.driver !== null &&
              String(row.driver.id) === driverId &&
              (row.car === null ? !carId : String(row.car.id) === carId);
            const isCurrent =
              current !== null &&
              row.driver?.id === current.driverId &&
              row.car?.id === current.carId;
            return (
              <li key={row.key}>
                <button
                  type="button"
                  onClick={() => choose(row)}
                  aria-pressed={active}
                  className={cx(
                    "flex w-full gap-3 rounded-md border p-3 text-left transition-colors",
                    active
                      ? "border-accent bg-accent-soft"
                      : "border-line hover:border-line-strong hover:bg-sunken",
                    v.blocks.length ? "opacity-75" : "",
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-ink text-base font-semibold">
                        {row.driver?.name ?? "No driver linked"}
                      </span>
                      {row.driver?.engagement === "outsourced" ? (
                        <Badge tone="special">Outsourced</Badge>
                      ) : null}
                      {isCurrent ? <Badge tone="info">Assigned now</Badge> : null}
                      {v.blocks.length ? (
                        <Badge
                          tone="danger"
                          icon={<Ban aria-hidden className="h-3 w-3" />}
                        >
                          Cannot go
                        </Badge>
                      ) : !row.driver || !row.car ? null : v.warnings.length ? (
                        <Badge
                          tone="warn"
                          icon={<AlertTriangle aria-hidden className="h-3 w-3" />}
                        >
                          {v.warnings.length === 1
                            ? "1 thing to check"
                            : `${v.warnings.length} things to check`}
                        </Badge>
                      ) : (
                        <Badge
                          tone="ok"
                          icon={<CheckCircle2 aria-hidden className="h-3 w-3" />}
                        >
                          All clear
                        </Badge>
                      )}
                    </span>
                    <span className="text-ink-2 text-sm">
                      {row.car ? (
                        <>
                          <span className="font-medium tabular-nums">
                            {row.car.registration}
                          </span>{" "}
                          · {carText(row.car)}
                        </>
                      ) : (
                        <span className="text-ink-3">
                          No car linked — choose one below
                        </span>
                      )}
                    </span>
                    {v.blocks.length ? (
                      <span className="text-danger text-sm">{v.blocks.join(" ")}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-line bg-surface sticky bottom-0 -mx-4 flex flex-col gap-3 border-t px-4 pt-4 pb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label
              htmlFor="assign-driver"
              className="text-ink-2 mb-1 block text-sm font-medium"
            >
              Driver
            </label>
            <SearchSelect
              id="assign-driver"
              options={drivers.map((option) => ({
                value: String(option.id),
                label: option.name,
                detail: [
                  option.phone,
                  ...option.carIds.map(
                    (id) => carById.get(String(id))?.registration ?? "",
                  ),
                ]
                  .filter(Boolean)
                  .join(" · "),
                badge:
                  option.engagement === "outsourced" ? (
                    <Badge tone="special">Outsourced</Badge>
                  ) : option.blocks.length ? (
                    <Badge tone="danger">Cannot go</Badge>
                  ) : undefined,
              }))}
              value={driverId}
              onChange={(value) => {
                const next = driverById.get(String(value));
                setDriverId(String(value));
                // Their own car, unless one of theirs is already chosen.
                if (next && !next.carIds.includes(Number(carId)) && next.carIds[0]) {
                  setCarId(String(next.carIds[0]));
                }
              }}
              placeholder="Type a name"
            />
          </div>
          <div className="min-w-0">
            <label
              htmlFor="assign-car"
              className="text-ink-2 mb-1 block text-sm font-medium"
            >
              Car
            </label>
            <SearchSelect
              id="assign-car"
              options={cars.map((option) => ({
                value: String(option.id),
                label: option.registration,
                detail: carText(option),
                keywords: [option.make, option.model, `${option.make} ${option.model}`],
                badge: option.blocks.length ? (
                  <Badge tone="danger">Cannot go</Badge>
                ) : undefined,
              }))}
              value={carId}
              onChange={(value) => setCarId(String(value))}
              placeholder="Type a registration or model"
            />
          </div>
        </div>

        {driver && car ? (
          <div className="flex flex-col gap-1 text-sm">
            <p className="text-ink">
              Assign <strong>{driver.name}</strong> with{" "}
              <strong className="tabular-nums">{car.registration}</strong>.
            </p>
            {chosen.blocks.length ? (
              <ul className="text-danger flex flex-col gap-0.5">
                {chosen.blocks.map((block) => (
                  <li key={block}>{block}</li>
                ))}
              </ul>
            ) : null}
            {chosen.warnings.length ? (
              <ul className="text-warn flex flex-col gap-0.5">
                {chosen.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            {!chosen.blocks.length && chosen.warnings.length ? (
              <p className="text-ink-3 text-xs">
                These do not stop the assignment — check them first.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-ink-3 text-sm">Choose a driver and a car.</p>
        )}

        {replacing ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="taken-off-reason" className="text-ink-2 text-sm font-medium">
              Why is {current.name} coming off this booking?
            </label>
            <textarea
              id="taken-off-reason"
              name="reason"
              rows={2}
              maxLength={1000}
              required
              className={TEXTAREA_CLASS}
              {...invalid(state.errors.reason, "taken-off-reason")}
            />
            {state.errors.reason ? (
              <p id="taken-off-reason-error" className="text-danger text-sm">
                {state.errors.reason}
              </p>
            ) : (
              <p className="text-ink-3 text-xs">
                Kept on the booking&apos;s history and shown in the Driver Report.
              </p>
            )}
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <label htmlFor="driverPrice" className="text-ink-2 text-sm font-medium">
            Driver price
          </label>
          <div className="relative w-36">
            <span
              aria-hidden
              className="text-ink-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base lg:text-sm"
            >
              £
            </span>
            <input
              id="driverPrice"
              name="driverPrice"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={
                driverPricePence === null ? "" : (driverPricePence / 100).toFixed(2)
              }
              placeholder="0.00"
              className={inputClass("pl-7 tabular-nums")}
              {...invalid(state.errors.driverPrice, "driverPrice")}
            />
          </div>
          {state.errors.driverPrice ? (
            <p id="driverPrice-error" className="text-danger text-sm">
              {state.errors.driverPrice}
            </p>
          ) : (
            <p className="text-ink-3 text-xs">
              What Cityline pays the driver for this booking. It goes in their WhatsApp
              message; it can also be written later on the booking.
            </p>
          )}
        </div>
        {!passengerEmails ? (
          // Switched off: the booking's own choice is kept for when it is on.
          notifyPassenger ? (
            <input type="hidden" name="notifyPassenger" value="on" />
          ) : null
        ) : canEmailPassenger ? (
          <label
            htmlFor="notifyPassenger"
            className="text-ink-2 flex cursor-pointer items-center gap-2 text-sm"
          >
            <input
              id="notifyPassenger"
              name="notifyPassenger"
              type="checkbox"
              defaultChecked={notifyPassenger}
              className="accent-accent h-4 w-4"
            />
            Email the passenger their driver&apos;s details
          </label>
        ) : (
          <p className="text-ink-3 text-xs">
            There is no passenger email on this job, so no driver details will be emailed.
          </p>
        )}
        <FormMessage state={state} />
        {/* The server's own reason when it refuses the pair. */}
        {state.errors.pair || state.errors.driver || state.errors.vehicle ? (
          <p role="alert" className="text-danger text-sm">
            {state.errors.pair ?? state.errors.driver ?? state.errors.vehicle}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <SubmitButton pending={pending} pendingLabel="Assigning…">
            <UserCheck aria-hidden className="h-4 w-4" />
            Confirm assignment
          </SubmitButton>
          <Link href={cancelHref} className={buttonClass("ghost", "md")}>
            Cancel
          </Link>
        </div>
        {!ready && driver && car ? (
          <p className="text-ink-3 text-xs">
            This pair cannot be assigned until the above is put right — or choose another
            driver or car.
          </p>
        ) : null}
      </div>
    </form>
  );
}
