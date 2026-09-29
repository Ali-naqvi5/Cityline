"use client";

import {
  ArrowRight,
  Flag,
  Hourglass,
  Luggage,
  MapPin,
  MapPinPlus,
  Minus,
  Plus,
  Users,
  X,
} from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";

import { useEarliestBookableDate } from "@/components/booking/use-earliest-bookable-date";
import { DatePicker, TimePicker } from "@/components/ui/date-time-picker";
import { bookingRules } from "@/domain/booking/rules";

/**
 * The quote widget (SEO-08), ported from the hero card in the home design.
 *
 * It submits with a plain GET to `/book`, so it works before JavaScript loads
 * and the resulting URL is shareable. Google Places autocomplete (BK-02) and
 * live fares arrive in S3 — today the location fields are free text.
 *
 * `variant` covers the placements §6 asks for: "hero" is the card in the hero,
 * "inline" drops the elevation so it can sit inside a landing page.
 *
 * Two modes (§7 service types):
 *   route  — A to B, with via stops (BK-04) and an optional return leg
 *   hourly — a car and driver for a number of hours, no drop-off
 *
 * Switching between them does not swap one form for another: the fields the two
 * modes share stay put, and only the differences expand or collapse. That is
 * what makes it read as one widget changing shape rather than two widgets
 * flickering.
 */
type ServiceTab = "route" | "hourly";

const TABS: { id: ServiceTab; label: string }[] = [
  { id: "route", label: "Route" },
  { id: "hourly", label: "Hourly hire" },
];

/**
 * One duration for every expand and collapse, so nothing in the widget moves at
 * a different speed from anything else.
 *
 * 350ms is the usual range for a panel of this size: slow enough to follow,
 * fast enough that a quick typer is never waiting on it. Raise it here and
 * every transition follows.
 */
const TRANSITION_MS = 350;

/** Hourly hire (§7: £/hour per class, with a minimum). */
const MIN_HIRE_HOURS = 3;
const MAX_HIRE_HOURS = 12;

const FIELD =
  "bg-surface-container-low/70 focus:bg-surface-container-lowest text-body-md " +
  "text-on-surface placeholder:text-on-surface-variant/60 rounded-input h-12 w-full transition-all";

export function QuoteWidget({ variant = "hero" }: { variant?: "hero" | "inline" }) {
  const rules = bookingRules();
  const ids = useId();
  // Worked out in the browser: the pages carrying this widget are mostly
  // static, and a date baked in at build time goes stale (BK-05).
  const minDate = useEarliestBookableDate();

  const [tab, setTab] = useState<ServiceTab>("route");

  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [stops, setStops] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [passengers, setPassengers] = useState(2);
  const [bags, setBags] = useState(2);
  const [hours, setHours] = useState(MIN_HIRE_HOURS);

  const [returnJourney, setReturnJourney] = useState(false);
  const [returnStops, setReturnStops] = useState<string[]>([]);
  // `null` means "still mirroring the outbound leg". A return journey is the
  // outbound reversed until the customer says otherwise, so the fields fill
  // themselves in and stay in step — but the moment someone types, their value
  // wins and stops being overwritten.
  const [returnPickup, setReturnPickup] = useState<string | null>(null);
  const [returnDropoff, setReturnDropoff] = useState<string | null>(null);
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [returnPassengers, setReturnPassengers] = useState<number | null>(null);
  const [returnBags, setReturnBags] = useState<number | null>(null);

  const isRoute = tab === "route";

  const shell =
    variant === "hero"
      ? "bg-surface-container-lowest rounded-card shadow-quote p-6 sm:p-7"
      : "bg-surface-container-lowest rounded-card border border-outline-variant p-6";

  return (
    <form action="/book" method="get" className={shell}>
      <input type="hidden" name="service" value={tab} />

      <ModeTabs value={tab} onChange={setTab} panelId={`${ids}-panel`} />

      <div id={`${ids}-panel`} className="flex flex-col">
        {/* --- Pickup, stops and drop-off ---------------------------------- */}
        {/*
          No `gap` on this column. The collapsible below it shrinks to nothing
          in hourly mode, and a flex gap would still be collected either side of
          it — leaving a band of empty space under the pickup field where the
          drop-off used to be. Spacing lives inside the collapsible instead, so
          it collapses with the content.
        */}
        <div className="flex flex-col">
          <PlaceField
            id={`${ids}-pickup`}
            name="pickup"
            icon={<MapPin aria-hidden className="text-primary h-5 w-5" />}
            label="Pickup address, postcode or terminal"
            value={pickup}
            onChange={setPickup}
            required
          />

          {/* Route only: everything between pickup and the date row. */}
          <Collapsible open={isRoute}>
            <div className="flex flex-col gap-3 pt-3">
              <StopFields
                idPrefix={`${ids}-stop`}
                name="via"
                stops={stops}
                onChange={setStops}
              />

              <PlaceField
                id={`${ids}-dropoff`}
                name="dropoff"
                icon={<Flag aria-hidden className="text-primary h-5 w-5" />}
                label="Drop-off address, airport or hotel"
                value={dropoff}
                onChange={setDropoff}
                required
              />

              <AddStopButton
                count={stops.length}
                max={rules.maxViaStops}
                onAdd={() => setStops([...stops, ""])}
              />
            </div>
          </Collapsible>
        </div>

        {/* --- When ---------------------------------------------------------- */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DatePicker
            id={`${ids}-date`}
            name="date"
            label="Pickup date"
            value={date}
            onChange={setDate}
            min={minDate}
            required
          />
          <TimePicker
            id={`${ids}-time`}
            name="time"
            label={isRoute ? "Pickup time" : "Start time"}
            value={time}
            onChange={setTime}
            required
          />
        </div>

        {/* Hourly only: how long the car is booked for. */}
        <Collapsible open={!isRoute}>
          <div className="pt-3">
            <Stepper
              name="hours"
              label="Hours"
              suffix={`min ${MIN_HIRE_HOURS}`}
              icon={<Hourglass aria-hidden className="text-primary h-5 w-5" />}
              value={hours}
              min={MIN_HIRE_HOURS}
              max={MAX_HIRE_HOURS}
              onChange={setHours}
            />
          </div>
        </Collapsible>

        {/* --- Who ----------------------------------------------------------- */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stepper
            name="passengers"
            label="Passengers"
            icon={<Users aria-hidden className="text-primary h-5 w-5" />}
            value={passengers}
            min={1}
            max={rules.maxPassengers}
            onChange={setPassengers}
          />
          <Stepper
            name="bags"
            label="Luggage"
            icon={<Luggage aria-hidden className="text-primary h-5 w-5" />}
            value={bags}
            min={0}
            max={rules.maxLargeBags}
            onChange={setBags}
          />
        </div>

        {/* --- Return leg (route only, BK-04) -------------------------------- */}
        <Collapsible open={isRoute}>
          <div className="pt-4">
            <label className="flex cursor-pointer items-center gap-2.5 select-none">
              <input
                type="checkbox"
                name="return"
                value="yes"
                checked={returnJourney}
                onChange={(event) => setReturnJourney(event.target.checked)}
                aria-expanded={returnJourney}
                aria-controls={`${ids}-return`}
                className="accent-primary h-4 w-4 rounded"
              />
              <span className="text-body-md text-on-surface-variant">
                Add a return journey
              </span>
            </label>

            <Collapsible open={returnJourney} id={`${ids}-return`}>
              <div className="border-outline-variant mt-4 flex flex-col gap-3 border-t pt-4">
                <p className="text-label-sm text-on-surface-variant uppercase">
                  Return journey
                </p>

                <PlaceField
                  id={`${ids}-return-pickup`}
                  name="returnPickup"
                  icon={<MapPin aria-hidden className="text-primary h-5 w-5" />}
                  label="Return pickup address"
                  value={returnPickup ?? dropoff}
                  onChange={setReturnPickup}
                  required
                />

                <StopFields
                  idPrefix={`${ids}-return-stop`}
                  name="returnVia"
                  stops={returnStops}
                  onChange={setReturnStops}
                />

                <PlaceField
                  id={`${ids}-return-dropoff`}
                  name="returnDropoff"
                  icon={<Flag aria-hidden className="text-primary h-5 w-5" />}
                  label="Return drop-off address"
                  value={returnDropoff ?? pickup}
                  onChange={setReturnDropoff}
                  required
                />

                <AddStopButton
                  count={returnStops.length}
                  max={rules.maxViaStops}
                  onAdd={() => setReturnStops([...returnStops, ""])}
                />

                <div className="grid grid-cols-2 gap-3">
                  <DatePicker
                    id={`${ids}-return-date`}
                    name="returnDate"
                    label="Return date"
                    value={returnDate}
                    onChange={setReturnDate}
                    // The return leg cannot leave before the outbound one
                    // (enforced again server-side in `journeySchema`).
                    min={date || minDate}
                    required
                  />
                  <TimePicker
                    id={`${ids}-return-time`}
                    name="returnTime"
                    label="Return time"
                    value={returnTime}
                    onChange={setReturnTime}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/*
                    Mirrors the outbound party until someone changes it, then
                    holds its own value — four people out and five back is a
                    real booking, and the vehicle is sized to the larger leg.
                  */}
                  <Stepper
                    name="returnPassengers"
                    label="Passengers"
                    icon={<Users aria-hidden className="text-primary h-5 w-5" />}
                    value={returnPassengers ?? passengers}
                    min={1}
                    max={rules.maxPassengers}
                    onChange={setReturnPassengers}
                  />
                  <Stepper
                    name="returnBags"
                    label="Luggage"
                    icon={<Luggage aria-hidden className="text-primary h-5 w-5" />}
                    value={returnBags ?? bags}
                    min={0}
                    max={rules.maxLargeBags}
                    onChange={setReturnBags}
                  />
                </div>
              </div>
            </Collapsible>
          </div>
        </Collapsible>
      </div>

      <button
        type="submit"
        className="bg-primary-container text-on-primary hover:bg-secondary rounded-button text-label-md mt-5 flex h-12 w-full items-center justify-center gap-2 font-semibold transition-colors"
      >
        See prices
        <ArrowRight aria-hidden className="h-4 w-4" />
      </button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Route / Hourly hire, as an ARIA tablist.
 *
 * A tablist owes the keyboard more than click handlers: arrow keys move between
 * tabs, Home and End jump to the ends, and only the selected tab is in the tab
 * order (roving tabindex), so Tab from the tabs lands in the form rather than
 * walking through every tab first (NFR-05).
 */
function ModeTabs({
  value,
  onChange,
  panelId,
}: {
  value: ServiceTab;
  onChange: (next: ServiceTab) => void;
  panelId: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const last = TABS.length - 1;
    let next: number | null = null;

    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;

    event.preventDefault();
    const tab = TABS[next];
    if (!tab) return;
    onChange(tab.id);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Type of booking"
      className="bg-surface-container-low mb-5 flex items-center rounded-lg p-1"
    >
      {TABS.map((item, index) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={[
              "text-label-md flex-1 rounded-lg py-2 text-center transition-all",
              active
                ? "bg-surface-container-lowest text-primary shadow-card font-semibold"
                : "text-on-surface-variant hover:text-on-surface",
            ].join(" ")}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Expands and collapses to fit its content.
 *
 * `grid-template-rows: 0fr → 1fr` animates to a height nobody has to measure,
 * which means the panel is correct at any font size or text length — no
 * hard-coded max-height that clips the day someone adds a third stop.
 *
 * The content sits in a `fieldset` that is disabled while closed. That is doing
 * real work: a disabled fieldset takes its controls out of the tab order *and*
 * out of the submitted form, so a collapsed drop-off field cannot quietly send
 * a value on an hourly booking, and `required` on a hidden field cannot block
 * submission with a validation message pointing at something invisible.
 */
function Collapsible({
  open,
  id,
  children,
}: {
  open: boolean;
  id?: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      className="grid transition-[grid-template-rows,opacity] ease-out motion-reduce:transition-none"
      style={{
        gridTemplateRows: open ? "1fr" : "0fr",
        opacity: open ? 1 : 0,
        transitionDuration: `${TRANSITION_MS}ms`,
      }}
    >
      <fieldset
        disabled={!open}
        aria-hidden={!open}
        className="m-0 min-h-0 overflow-hidden border-0 p-0"
      >
        {children}
      </fieldset>
    </div>
  );
}

function PlaceField({
  id,
  name,
  icon,
  label,
  value,
  onChange,
  required,
}: {
  id: string;
  name: string;
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
}) {
  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-3.5 flex items-center">
        {icon}
      </span>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={label}
        className={`${FIELD} pr-4 pl-11`}
      />
    </div>
  );
}

/** Via stops (BK-04), rendered between the pickup and the drop-off. */
function StopFields({
  idPrefix,
  name,
  stops,
  onChange,
}: {
  idPrefix: string;
  name: string;
  stops: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <>
      {stops.map((stop, index) => (
        <div key={index} className="relative flex items-center">
          <MapPinPlus
            aria-hidden
            className="text-primary pointer-events-none absolute left-3.5 h-5 w-5"
          />
          <label htmlFor={`${idPrefix}-${index}`} className="sr-only">
            Stop {index + 1}
          </label>
          <input
            id={`${idPrefix}-${index}`}
            name={name}
            value={stop}
            onChange={(event) => {
              const next = [...stops];
              next[index] = event.target.value;
              onChange(next);
            }}
            required
            placeholder={`Stop ${index + 1} — address or postcode`}
            className={`${FIELD} pr-12 pl-11`}
          />
          <button
            type="button"
            onClick={() => onChange(stops.filter((_, i) => i !== index))}
            aria-label={`Remove stop ${index + 1}`}
            className="text-on-surface-variant hover:text-error absolute right-3.5 flex h-6 w-6 items-center justify-center rounded-full transition-colors"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      ))}
    </>
  );
}

function AddStopButton({
  count,
  max,
  onAdd,
}: {
  count: number;
  max: number;
  onAdd: () => void;
}) {
  if (count >= max) {
    return (
      <p className="text-body-sm text-on-surface-variant">
        That is the most stops we can price online. Call us to add more.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={onAdd}
      className="text-label-md text-primary hover:text-secondary inline-flex items-center gap-1.5 self-start transition-colors"
    >
      <Plus aria-hidden className="h-4 w-4" />
      {count === 0 ? "Add stop" : "Add another stop"}
    </button>
  );
}

function Stepper({
  name,
  label,
  suffix,
  icon,
  value,
  min,
  max,
  onChange,
}: {
  name: string;
  label: string;
  suffix?: string;
  icon: ReactNode;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="bg-surface-container-low/70 rounded-input flex h-12 items-center justify-between px-3">
      <span className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="text-body-sm text-on-surface-variant truncate">
          {label}
          {suffix ? (
            <span className="text-on-surface-variant/70"> · {suffix}</span>
          ) : null}
        </span>
      </span>

      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`One fewer ${label.toLowerCase()}`}
          className="text-on-surface disabled:opacity-30"
        >
          <Minus aria-hidden className="h-4 w-4" />
        </button>
        <output className="text-title-md w-6 text-center tabular-nums" aria-live="polite">
          {value}
        </output>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`One more ${label.toLowerCase()}`}
          className="text-on-surface disabled:opacity-30"
        >
          <Plus aria-hidden className="h-4 w-4" />
        </button>
        <input type="hidden" name={name} value={value} />
      </span>
    </div>
  );
}
