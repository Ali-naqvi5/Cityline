"use client";

import {
  AlertTriangle,
  Armchair,
  CarFront,
  Clock,
  MessageSquareText,
  Plane,
  Plus,
  PoundSterling,
  Radio,
  Trash2,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";

import { saveJobAction } from "@/admin/actions/dispatch";
import { EMPTY_FORM, type JobFormState } from "@/admin/form-state";
import {
  FormField,
  FormMessage,
  inputClass,
  invalid,
  SubmitButton,
  submitWith,
  TEXTAREA_COMPACT_CLASS,
} from "@/components/ops/form";
import { Badge, buttonClass, Panel } from "@/components/ops/primitives";
import { Segmented } from "@/components/ops/segmented";
import { Stepper } from "@/components/ops/stepper";
import {
  JOB_SOURCE_LABELS,
  MAX_STOPS,
  PAYMENT_METHOD_LABELS,
  STAFF_PAYMENT_METHODS,
  STAFF_SOURCES,
  vehicleClassName,
} from "@/domain/jobs/labels";
import { formatPence, parsePounds, type Pence } from "@/domain/money";
import { EXTRAS } from "@/domain/pricing/extras";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";

export interface JobFormValues {
  id?: number;
  returnOf?: number;
  source: string;
  supplier: string;
  supplierReference: string;
  pickupDate: string;
  pickupTime: string;
  /** "transfer" (point to point) or "hourly". */
  bookingType: string;
  pickupAddress: string;
  stops: string[];
  dropoffAddress: string;
  hours: string;
  flightNumber: string;
  vehicleClassSlug: string;
  passengers: string;
  largeBags: string;
  smallBags: string;
  leadName: string;
  leadPhone: string;
  leadEmail: string;
  nameBoardText: string;
  meetAndGreet: boolean;
  bookerName: string;
  bookerPhone: string;
  bookerEmail: string;
  extras: Record<string, number>;
  price: string;
  paymentMethod: string;
  driverNotes: string;
  internalNotes: string;
  notifyPassenger: boolean;
  isTest: boolean;
}

export interface SupplierChoice {
  id: number;
  name: string;
}

/** Today and the time in London, for the quick time buttons. */
function londonParts(instant: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

/** Now plus some minutes, rounded up to the next five. */
function soon(minutes: number): { date: string; time: string } {
  const step = 5 * 60_000;
  const at = new Date(Math.ceil((Date.now() + minutes * 60_000) / step) * step);
  return londonParts(at);
}

const count = (value: string) => Number(value) || 0;
/** "Fri 9 Oct" for a YYYY-MM-DD day. */
const dayName = (day: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(day)
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "UTC",
        weekday: "short",
        day: "numeric",
        month: "short",
      })
        .format(new Date(`${day}T12:00:00Z`))
        .replace(",", "")
    : day;
const short = (address: string) => address.split(",")[0]?.trim() || address;

function Tick({
  name,
  label,
  defaultChecked,
  hint,
}: {
  name: string;
  label: ReactNode;
  defaultChecked: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="text-ink-2 flex min-h-9 cursor-pointer items-start gap-2 text-sm"
      >
        <input
          id={name}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          className="accent-accent mt-0.5 h-4 w-4 shrink-0"
        />
        <span>{label}</span>
      </label>
      {hint ? <p className="text-ink-3 -mt-1 ml-6 text-xs">{hint}</p> : null}
    </div>
  );
}

/**
 * The staff job form (spec §13), laid out to be filled at the speed of a
 * phone call (Cityline, 9 Oct 2026): the journey and the passengers on the
 * left, where it came from and the money on the right, and a bar along the
 * bottom that reads the booking back before it is saved.
 *
 * `website` mode is for a website booking's job: only the operational
 * details, with price, customer and route shown as locked (JOB-07).
 */
export function JobForm({
  values,
  suppliers,
  cancelHref,
  mode,
  locked,
}: {
  values: JobFormValues;
  suppliers: SupplierChoice[];
  cancelHref: string;
  mode: "new" | "edit" | "website";
  locked?: ReactNode;
}) {
  const [state, action, pending] = useActionState<JobFormState, FormData>(
    saveJobAction,
    EMPTY_FORM,
  );
  const e = state.errors;
  const website = mode === "website";

  const [source, setSource] = useState(values.source);
  const [bookingType, setBookingType] = useState(values.bookingType || "transfer");
  const [pickupDate, setPickupDate] = useState(values.pickupDate);
  const [pickupTime, setPickupTime] = useState(values.pickupTime);
  const [pickup, setPickup] = useState(values.pickupAddress);
  const [dropoff, setDropoff] = useState(values.dropoffAddress);
  const [hours, setHours] = useState(values.hours);
  const [stops, setStops] = useState(() =>
    values.stops.map((address, index) => ({ key: index, address })),
  );
  const [nextKey, setNextKey] = useState(values.stops.length);
  const [flight, setFlight] = useState(values.flightNumber);
  const [vehicleClass, setVehicleClass] = useState(values.vehicleClassSlug);
  const [passengers, setPassengers] = useState(count(values.passengers) || 1);
  const [largeBags, setLargeBags] = useState(count(values.largeBags));
  const [smallBags, setSmallBags] = useState(count(values.smallBags));
  const [leadName, setLeadName] = useState(values.leadName);
  const [extras, setExtras] = useState<Record<string, number>>(values.extras);
  const [price, setPrice] = useState(values.price);

  const supplierJob = source === "supplier";
  const hourly = bookingType === "hourly";
  const chosenClass = VEHICLE_CLASSES.find((item) => item.slug === vehicleClass);
  const pricePence = parsePounds(price);
  const setWhen = ({ date, time }: { date: string; time: string }) => {
    setPickupDate(date);
    setPickupTime(time);
  };

  const route = hourly
    ? `${short(pickup) || "Pickup"} · ${hours ? `${hours} hours` : "hourly"}`
    : `${short(pickup) || "Pickup"} → ${short(dropoff) || "Drop-off"}`;
  const readBack = [
    leadName,
    flight ? `Flight ${flight.toUpperCase()}` : null,
    `${passengers} ${passengers === 1 ? "passenger" : "passengers"}`,
    `${largeBags} large / ${smallBags} small`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-5" noValidate>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      {values.returnOf ? (
        <input type="hidden" name="returnOf" value={values.returnOf} />
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* The journey and the people. */}
        <div className="flex min-w-0 flex-col gap-5">
          <Panel icon={<Clock />} title="Journey and time">
            <div className="grid gap-4 sm:grid-cols-2">
              {!website ? (
                <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
                  <Segmented
                    name="bookingType"
                    legend="Point to point or hourly"
                    options={[
                      { value: "transfer", label: "Point to point" },
                      { value: "hourly", label: "Hourly (as directed)" },
                    ]}
                    value={bookingType}
                    onChange={setBookingType}
                  />
                  <div className="flex flex-wrap gap-1" aria-label="Quick pickup times">
                    {[
                      { label: "Now", at: () => soon(0) },
                      { label: "+1 hour", at: () => soon(60) },
                      {
                        label: "Tomorrow 06:00",
                        at: () => ({ date: soon(24 * 60).date, time: "06:00" }),
                      },
                    ].map((quick) => (
                      <button
                        key={quick.label}
                        type="button"
                        onClick={() => setWhen(quick.at())}
                        className="bg-accent-soft text-accent hover:bg-accent-line/60 rounded-md px-2 py-1 text-xs font-medium"
                      >
                        {quick.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <FormField
                id="pickupDate"
                label="Pickup date"
                required
                error={e.pickupDate}
                aside="London time"
              >
                <input
                  id="pickupDate"
                  name="pickupDate"
                  type="date"
                  value={pickupDate}
                  onChange={(event) => setPickupDate(event.target.value)}
                  className={inputClass()}
                  {...invalid(e.pickupDate, "pickupDate")}
                />
              </FormField>
              <FormField
                id="pickupTime"
                label="Pickup time"
                required
                error={e.pickupTime}
              >
                <input
                  id="pickupTime"
                  name="pickupTime"
                  type="time"
                  value={pickupTime}
                  onChange={(event) => setPickupTime(event.target.value)}
                  className={inputClass()}
                  {...invalid(e.pickupTime, "pickupTime")}
                />
              </FormField>

              {!website ? (
                <>
                  <FormField
                    id="pickupAddress"
                    label="Pickup"
                    required
                    wide
                    error={e.pickupAddress}
                    hint="For an airport, include the terminal."
                    aside={
                      !hourly && stops.length < MAX_STOPS ? (
                        <button
                          type="button"
                          className="text-accent inline-flex items-center gap-1 font-medium hover:underline"
                          onClick={() => {
                            setStops([...stops, { key: nextKey, address: "" }]);
                            setNextKey(nextKey + 1);
                          }}
                        >
                          <Plus aria-hidden className="h-3.5 w-3.5" />
                          Add a stop
                        </button>
                      ) : undefined
                    }
                  >
                    <input
                      id="pickupAddress"
                      name="pickupAddress"
                      value={pickup}
                      onChange={(event) => setPickup(event.target.value)}
                      className={inputClass()}
                      {...invalid(e.pickupAddress, "pickupAddress")}
                    />
                  </FormField>
                  {!hourly
                    ? stops.map((stop, index) => (
                        <div
                          key={stop.key}
                          className="flex items-end gap-2 sm:col-span-2"
                        >
                          <FormField
                            id={`stop-${stop.key}`}
                            label={`Stop ${index + 1}`}
                            wide
                          >
                            <input
                              id={`stop-${stop.key}`}
                              name="stop"
                              defaultValue={stop.address}
                              className={inputClass()}
                            />
                          </FormField>
                          <button
                            type="button"
                            aria-label={`Remove stop ${index + 1}`}
                            className={buttonClass("ghost", "md", "px-2.5")}
                            onClick={() =>
                              setStops(stops.filter((item) => item.key !== stop.key))
                            }
                          >
                            <Trash2 aria-hidden className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    : null}
                  {hourly ? (
                    <FormField
                      id="hours"
                      label="Hours"
                      required
                      error={e.hours}
                      hint="How long the car is booked for, 1 to 24."
                    >
                      <input
                        id="hours"
                        name="hours"
                        inputMode="numeric"
                        value={hours}
                        onChange={(event) => setHours(event.target.value)}
                        className={inputClass("tabular-nums")}
                        {...invalid(e.hours, "hours")}
                      />
                    </FormField>
                  ) : (
                    <FormField
                      id="dropoffAddress"
                      label="Drop-off"
                      required
                      wide
                      error={e.dropoffAddress}
                    >
                      <input
                        id="dropoffAddress"
                        name="dropoffAddress"
                        value={dropoff}
                        onChange={(event) => setDropoff(event.target.value)}
                        className={inputClass()}
                        {...invalid(e.dropoffAddress, "dropoffAddress")}
                      />
                    </FormField>
                  )}
                </>
              ) : null}

              <FormField
                id="flightNumber"
                label="Flight number"
                error={e.flightNumber}
                hint="So the office can check the arrival time before dispatch."
              >
                <div className="relative">
                  <Plane
                    aria-hidden
                    className="text-ink-4 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                  />
                  <input
                    id="flightNumber"
                    name="flightNumber"
                    value={flight}
                    onChange={(event) => setFlight(event.target.value)}
                    autoComplete="off"
                    placeholder="BA117"
                    className={inputClass("pl-9 uppercase")}
                    {...invalid(e.flightNumber, "flightNumber")}
                  />
                </div>
              </FormField>
            </div>
          </Panel>

          <Panel icon={<UsersRound />} title="Car and passengers">
            <div className="grid gap-4 sm:grid-cols-2">
              {!website ? (
                <div className="sm:col-span-2">
                  <p className="text-ink-2 mb-1 text-sm font-medium">
                    Vehicle class<span className="text-danger"> *</span>
                  </p>
                  <Segmented
                    name="vehicleClassSlug"
                    legend="Vehicle class"
                    options={VEHICLE_CLASSES.map((vehicle) => ({
                      value: vehicle.slug,
                      label: vehicle.name,
                      hint: `Up to ${vehicle.maxPassengers} passengers`,
                    }))}
                    value={vehicleClass}
                    onChange={setVehicleClass}
                  />
                  {e.vehicleClassSlug ? (
                    <p className="text-danger mt-1 text-sm">{e.vehicleClassSlug}</p>
                  ) : chosenClass ? (
                    <p className="text-ink-3 mt-1 text-xs">
                      Up to {chosenClass.maxPassengers} passengers.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                <FormField
                  id="passengers"
                  label="Passengers"
                  required
                  error={e.passengers}
                >
                  <Stepper
                    id="passengers"
                    name="passengers"
                    label="passengers"
                    value={passengers}
                    onChange={setPassengers}
                    min={1}
                    max={20}
                    invalid={Boolean(e.passengers)}
                    describedBy={e.passengers ? "passengers-error" : undefined}
                  />
                </FormField>
                <FormField id="largeBags" label="Large bags" error={e.largeBags}>
                  <Stepper
                    id="largeBags"
                    name="largeBags"
                    label="large bags"
                    value={largeBags}
                    onChange={setLargeBags}
                    max={30}
                  />
                </FormField>
                <FormField id="smallBags" label="Small bags" error={e.smallBags}>
                  <Stepper
                    id="smallBags"
                    name="smallBags"
                    label="small bags"
                    value={smallBags}
                    onChange={setSmallBags}
                    max={30}
                  />
                </FormField>
              </div>
              {!website ? (
                <>
                  <FormField
                    id="leadName"
                    label="Lead passenger"
                    required
                    error={e.leadName}
                  >
                    <input
                      id="leadName"
                      name="leadName"
                      value={leadName}
                      onChange={(event) => setLeadName(event.target.value)}
                      autoComplete="off"
                      className={inputClass()}
                      {...invalid(e.leadName, "leadName")}
                    />
                  </FormField>
                  <FormField
                    id="leadPhone"
                    label="Passenger phone"
                    required
                    error={e.leadPhone}
                  >
                    <input
                      id="leadPhone"
                      name="leadPhone"
                      type="tel"
                      defaultValue={values.leadPhone}
                      autoComplete="off"
                      className={inputClass("tabular-nums")}
                      {...invalid(e.leadPhone, "leadPhone")}
                    />
                  </FormField>
                  <FormField id="leadEmail" label="Passenger email" error={e.leadEmail}>
                    <input
                      id="leadEmail"
                      name="leadEmail"
                      type="email"
                      defaultValue={values.leadEmail}
                      autoComplete="off"
                      className={inputClass()}
                      {...invalid(e.leadEmail, "leadEmail")}
                    />
                  </FormField>
                </>
              ) : null}
              <FormField
                id="nameBoardText"
                label="Name board"
                error={e.nameBoardText}
                hint="The passenger's name if empty."
              >
                <input
                  id="nameBoardText"
                  name="nameBoardText"
                  defaultValue={values.nameBoardText}
                  autoComplete="off"
                  className={inputClass()}
                />
              </FormField>
              <div className="bg-accent-soft/60 border-accent-line rounded-md border px-3 py-2 sm:col-span-2">
                <Tick
                  name="meetAndGreet"
                  label={
                    <>
                      <span className="text-ink font-medium">Meet and greet</span> — the
                      driver waits in arrivals with a name board
                    </>
                  }
                  defaultChecked={values.meetAndGreet}
                />
              </div>
            </div>
          </Panel>
        </div>

        {/* Where it came from, the extras, the money and the notes. */}
        <div className="flex min-w-0 flex-col gap-5">
          {website ? locked : null}

          {!website ? (
            <Panel
              icon={<Radio />}
              title="Source"
              actions={
                supplierJob ? <Badge tone="info">Partner booking</Badge> : undefined
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="source" label="Source" required error={e.source}>
                  {mode === "edit" ? (
                    <>
                      <input type="hidden" name="source" value={source} />
                      <p className="text-ink flex h-10 items-center text-base lg:h-9 lg:text-sm">
                        {JOB_SOURCE_LABELS[source as keyof typeof JOB_SOURCE_LABELS] ??
                          source}
                      </p>
                    </>
                  ) : (
                    <select
                      id="source"
                      name="source"
                      value={source}
                      onChange={(event) => setSource(event.target.value)}
                      className={inputClass()}
                      {...invalid(e.source, "source")}
                    >
                      <option value="">Choose…</option>
                      {STAFF_SOURCES.map((item) => (
                        <option key={item} value={item}>
                          {JOB_SOURCE_LABELS[item]}
                        </option>
                      ))}
                    </select>
                  )}
                </FormField>
                {supplierJob ? (
                  <>
                    <FormField id="supplier" label="Partner" required error={e.supplier}>
                      <select
                        id="supplier"
                        name="supplier"
                        defaultValue={values.supplier}
                        className={inputClass()}
                        {...invalid(e.supplier, "supplier")}
                      >
                        <option value="">Choose…</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField
                      id="supplierReference"
                      label="Partner's reference"
                      required
                      wide
                      error={e.supplierReference}
                      hint="Their booking number. The same one cannot be entered twice."
                    >
                      <input
                        id="supplierReference"
                        name="supplierReference"
                        defaultValue={values.supplierReference}
                        autoComplete="off"
                        className={inputClass("uppercase tabular-nums")}
                        {...invalid(e.supplierReference, "supplierReference")}
                      />
                    </FormField>
                  </>
                ) : null}
                <details
                  className="border-line rounded-md border sm:col-span-2"
                  open={Boolean(
                    values.bookerName ||
                    values.bookerPhone ||
                    values.bookerEmail ||
                    e.bookerPhone ||
                    e.bookerEmail,
                  )}
                >
                  <summary className="text-accent cursor-pointer px-3 py-2 text-sm font-medium">
                    Booked by someone else — a PA, a travel agent
                  </summary>
                  <div className="grid gap-4 px-3 pt-1 pb-3 sm:grid-cols-2">
                    <FormField id="bookerName" label="Booker's name" error={e.bookerName}>
                      <input
                        id="bookerName"
                        name="bookerName"
                        defaultValue={values.bookerName}
                        autoComplete="off"
                        className={inputClass()}
                      />
                    </FormField>
                    <FormField
                      id="bookerPhone"
                      label="Booker's phone"
                      error={e.bookerPhone}
                    >
                      <input
                        id="bookerPhone"
                        name="bookerPhone"
                        type="tel"
                        defaultValue={values.bookerPhone}
                        autoComplete="off"
                        className={inputClass("tabular-nums")}
                        {...invalid(e.bookerPhone, "bookerPhone")}
                      />
                    </FormField>
                    <FormField
                      id="bookerEmail"
                      label="Booker's email"
                      wide
                      error={e.bookerEmail}
                    >
                      <input
                        id="bookerEmail"
                        name="bookerEmail"
                        type="email"
                        defaultValue={values.bookerEmail}
                        autoComplete="off"
                        className={inputClass()}
                        {...invalid(e.bookerEmail, "bookerEmail")}
                      />
                    </FormField>
                  </div>
                </details>
              </div>
            </Panel>
          ) : null}

          {!website ? (
            <Panel
              icon={<Armchair />}
              title="Child seats and extras"
              actions={
                <span className="text-ink-3 text-xs">Part of the agreed price</span>
              }
            >
              <div className="flex flex-col gap-2">
                {EXTRAS.map((extra) => (
                  <div
                    key={extra.slug}
                    className="border-line flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <label htmlFor={`extra-${extra.slug}`} className="min-w-0 text-sm">
                      <span className="text-ink block font-medium">
                        {extra.name.replace(/\s*\(.*\)$/, "")}
                      </span>
                      {/\((.*)\)$/.exec(extra.name)?.[1] ? (
                        <span className="text-ink-3 block text-xs">
                          {/\((.*)\)$/.exec(extra.name)?.[1]}
                        </span>
                      ) : null}
                    </label>
                    <div className="w-28 shrink-0">
                      <Stepper
                        id={`extra-${extra.slug}`}
                        name={`extra-${extra.slug}`}
                        label={extra.name.toLowerCase()}
                        value={extras[extra.slug] ?? 0}
                        onChange={(value) =>
                          setExtras((current) => ({ ...current, [extra.slug]: value }))
                        }
                        max={extra.maxQuantity}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          {!website ? (
            <Panel icon={<PoundSterling />} title="Price and payment">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="price"
                  label="Agreed price"
                  required
                  error={e.price}
                  hint={
                    supplierJob
                      ? "What the partner pays Cityline — their cut is already taken."
                      : "Agreed before the journey (CMP-02)."
                  }
                >
                  <div className="relative">
                    <span
                      aria-hidden
                      className="text-ink-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base font-medium"
                    >
                      £
                    </span>
                    <input
                      id="price"
                      name="price"
                      inputMode="decimal"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      placeholder="0.00"
                      className={inputClass(
                        "pl-7 text-lg font-semibold tabular-nums lg:text-base",
                      )}
                      {...invalid(e.price, "price")}
                    />
                  </div>
                </FormField>
                <FormField
                  id="paymentMethod"
                  label="Payment"
                  required
                  error={e.paymentMethod}
                >
                  <select
                    id="paymentMethod"
                    name="paymentMethod"
                    key={supplierJob ? "supplier" : "direct"}
                    defaultValue={supplierJob ? "supplier" : values.paymentMethod}
                    className={inputClass()}
                    {...invalid(e.paymentMethod, "paymentMethod")}
                  >
                    <option value="">Choose…</option>
                    {STAFF_PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {PAYMENT_METHOD_LABELS[method]}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            </Panel>
          ) : null}

          <Panel icon={<MessageSquareText />} title="Notes">
            <div className="flex flex-col gap-4">
              <FormField
                id="driverNotes"
                label="For the driver"
                aside="In their WhatsApp message"
              >
                <textarea
                  id="driverNotes"
                  name="driverNotes"
                  rows={2}
                  defaultValue={values.driverNotes}
                  className={TEXTAREA_COMPACT_CLASS}
                />
              </FormField>
              <FormField id="internalNotes" label="For the office" aside="Never sent">
                <textarea
                  id="internalNotes"
                  name="internalNotes"
                  rows={2}
                  defaultValue={values.internalNotes}
                  className={TEXTAREA_COMPACT_CLASS}
                />
              </FormField>
              <div className="flex flex-col gap-1">
                <Tick
                  name="notifyPassenger"
                  label="Email the passenger their driver's details when a driver is assigned"
                  defaultChecked={values.notifyPassenger}
                  hint="Some partners contact their passengers themselves."
                />
                {!website ? (
                  <Tick
                    name="isTest"
                    label="Test booking — kept out of reports and the TfL register"
                    defaultChecked={values.isTest}
                  />
                ) : null}
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {state.duplicates?.length ? (
        <div
          role="alert"
          className="border-warn-line bg-warn-soft flex flex-col gap-3 rounded-md border p-4"
        >
          <p className="text-warn flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle aria-hidden className="h-4 w-4" />
            This may already be entered
          </p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {state.duplicates.map((duplicate) => (
              <li key={duplicate.id}>
                <Link
                  href={`/admin/jobs/${duplicate.id}`}
                  target="_blank"
                  className="text-accent font-medium hover:underline"
                >
                  {duplicate.reference}
                </Link>{" "}
                · {duplicate.when} · {duplicate.passenger}{" "}
                <span className="text-ink-3">({duplicate.reasons.join(", ")})</span>
              </li>
            ))}
          </ul>
          <p className="text-ink-2 text-sm">
            If this is a different trip, save it anyway. Otherwise, go back.
          </p>
          <div>
            <button
              type="submit"
              name="confirmDuplicate"
              value="1"
              disabled={pending}
              className={buttonClass("secondary", "md")}
            >
              It is a different trip — save anyway
            </button>
          </div>
        </div>
      ) : (
        <FormMessage state={state} />
      )}

      {/* The booking read back, with the save button, always in reach. */}
      <div className="border-line bg-surface sticky bottom-[calc(74px+env(safe-area-inset-bottom))] z-20 flex flex-col gap-3 rounded-lg border p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between lg:bottom-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="bg-accent text-on-solid hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:flex"
          >
            <CarFront className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-ink flex flex-wrap items-center gap-2 font-semibold">
              <span className="truncate">{route}</span>
              {vehicleClass ? (
                <Badge tone="info">{vehicleClassName(vehicleClass)}</Badge>
              ) : null}
            </p>
            <p className="text-ink-3 truncate text-sm">
              {[
                pickupDate && pickupTime ? `${dayName(pickupDate)}, ${pickupTime}` : null,
                readBack,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
          {!website ? (
            <div className="text-right">
              <p className="text-ink-3 text-xs font-medium tracking-wide uppercase">
                Agreed price
              </p>
              <p className="text-ink text-xl font-semibold tabular-nums">
                {pricePence !== null && pricePence > 0
                  ? formatPence(pricePence as Pence)
                  : "—"}
              </p>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Link href={cancelHref} className={buttonClass("ghost", "md")}>
              Cancel
            </Link>
            <SubmitButton pending={pending}>
              {mode === "new"
                ? values.returnOf
                  ? "Create return trip"
                  : "Create booking"
                : "Save changes"}
            </SubmitButton>
          </div>
        </div>
      </div>
    </form>
  );
}
