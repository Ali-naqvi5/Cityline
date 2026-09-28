"use client";

import {
  ArrowRight,
  Flag,
  Hourglass,
  Luggage,
  MapPin,
  Plane,
  PlaneLanding,
  Plus,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

import { DatePicker, TimePicker } from "@/components/ui/date-time-picker";
import { Field, fieldControlClasses } from "@/components/ui/field";
import { type FunnelParams, type ServiceMode } from "@/domain/booking/funnel-params";
import { bookingRules } from "@/domain/booking/rules";
import { policies } from "@/lib/policies";

/**
 * Step 1 form (BK-01 … BK-05), ported from the booking step 1 design.
 *
 * Deliberately not carried over from the design: the panel promising that a
 * system watches your flight and moves your driver by itself. Cityline is not
 * building that, ever — see `domain/compliance/unsupported-claims.ts`. The
 * flight number is still collected, because the office needs it to time the
 * pickup, and the copy says exactly that.
 *
 * Google Places autocomplete (BK-02) replaces the free-text location fields in
 * S3, and the price is always recalculated on the server (BK-08).
 *
 * The two service modes match the quote widget, so someone who chose "Hourly
 * hire" in the hero does not arrive here being asked for a destination.
 * Fields belonging to the mode that is not showing are not rendered at all —
 * a `required` input that nobody can see blocks submission with a browser
 * message pointing at nothing.
 */
export function JourneyForm({
  defaults,
  minDate,
}: {
  defaults: FunnelParams;
  /**
   * Earliest bookable date (yyyy-mm-dd), so the picker cannot offer a date we
   * would reject. Computed on the server: reading the clock during a client
   * render is impure and would risk a hydration mismatch at midnight.
   */
  minDate: string;
}) {
  const rules = bookingRules();

  const [service, setService] = useState<ServiceMode>(defaults.service);
  const [pickup, setPickup] = useState(defaults.pickup);
  const [dropoff, setDropoff] = useState(defaults.dropoff);
  const [viaStops, setViaStops] = useState<string[]>(defaults.via);
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);
  const [returnDate, setReturnDate] = useState(defaults.returnDate);
  const [returnTime, setReturnTime] = useState(defaults.returnTime);

  const [returnJourney, setReturnJourney] = useState(defaults.returnJourney);
  const [returnVia, setReturnVia] = useState<string[]>(defaults.returnVia);
  // `null` means "still mirroring the outbound leg" — see the same pattern in
  // the quote widget.
  const [returnPickup, setReturnPickup] = useState<string | null>(
    defaults.returnPickup || null,
  );
  const [returnDropoff, setReturnDropoff] = useState<string | null>(
    defaults.returnDropoff || null,
  );

  const isRoute = service === "route";

  return (
    <form action="/book/vehicle" method="get" className="gap-space-xl flex flex-col">
      <input type="hidden" name="service" value={service} />

      <ModeToggle value={service} onChange={setService} />

      <section className="gap-space-md flex flex-col">
        <h2 className="text-headline-sm">
          {isRoute ? "Where are you going?" : "Where should we collect you?"}
        </h2>

        <Field
          id="pickup"
          name="pickup"
          label="Pickup location"
          required
          value={pickup}
          onChange={(event) => setPickup(event.target.value)}
          placeholder="Address, postcode or terminal"
          icon={<MapPin className="h-5 w-5" />}
          hint="Start typing an address, postcode, hotel or terminal."
        />

        {isRoute ? (
          <>
            <StopFields
              idPrefix="via"
              name="via"
              stops={viaStops}
              onChange={setViaStops}
            />

            <Field
              id="dropoff"
              name="dropoff"
              label="Drop-off destination"
              required
              value={dropoff}
              onChange={(event) => setDropoff(event.target.value)}
              placeholder="Address, airport, hotel or terminal"
              icon={<Flag className="h-5 w-5" />}
            />

            <AddStopButton
              count={viaStops.length}
              max={rules.maxViaStops}
              onAdd={() => setViaStops([...viaStops, ""])}
            />
          </>
        ) : (
          <Field
            id="hours"
            name="hours"
            type="number"
            label="How many hours do you need the car for?"
            required
            min={1}
            max={12}
            defaultValue={defaults.hours || 3}
            icon={<Hourglass className="h-5 w-5" />}
            hint="Your driver stays with you for the whole booking. Minimum hire varies by vehicle."
          />
        )}
      </section>

      <section className="gap-space-md flex flex-col">
        <h2 className="text-headline-sm">When?</h2>

        <div className="gap-space-md grid sm:grid-cols-2">
          <Field id="date" label="Pickup date" required>
            <DatePicker
              id="date"
              name="date"
              label="Pickup date"
              value={date}
              onChange={setDate}
              min={minDate}
              required
            />
          </Field>
          <Field
            id="time"
            label={isRoute ? "Pickup time" : "Start time"}
            required
            hint="London time."
          >
            <TimePicker
              id="time"
              name="time"
              label={isRoute ? "Pickup time" : "Start time"}
              value={time}
              onChange={setTime}
              required
            />
          </Field>
        </div>
      </section>

      {isRoute ? (
        <section className="gap-space-md flex flex-col">
          <h2 className="text-headline-sm">Coming back?</h2>

          <label className="flex cursor-pointer items-center gap-2.5 select-none">
            <input
              type="checkbox"
              name="return"
              value="yes"
              checked={returnJourney}
              onChange={(event) => setReturnJourney(event.target.checked)}
              className="accent-primary h-5 w-5 rounded"
            />
            <span className="text-body-md">I need a return journey</span>
          </label>

          {returnJourney ? (
            <div className="gap-space-md border-outline-variant pl-space-md flex flex-col border-l-2">
              <p className="text-body-sm text-on-surface-variant">
                We have filled this in as your outbound journey reversed. Change anything
                that is different.
              </p>

              <Field
                id="return-pickup"
                name="returnPickup"
                label="Return pickup location"
                required
                value={returnPickup ?? dropoff}
                onChange={(event) => setReturnPickup(event.target.value)}
                icon={<MapPin className="h-5 w-5" />}
              />

              <StopFields
                idPrefix="return-via"
                name="returnVia"
                stops={returnVia}
                onChange={setReturnVia}
              />

              <Field
                id="return-dropoff"
                name="returnDropoff"
                label="Return drop-off destination"
                required
                value={returnDropoff ?? pickup}
                onChange={(event) => setReturnDropoff(event.target.value)}
                icon={<Flag className="h-5 w-5" />}
              />

              <AddStopButton
                count={returnVia.length}
                max={rules.maxViaStops}
                onAdd={() => setReturnVia([...returnVia, ""])}
              />

              <div className="gap-space-md grid sm:grid-cols-2">
                <Field id="return-date" label="Return date" required>
                  <DatePicker
                    id="return-date"
                    name="returnDate"
                    label="Return date"
                    value={returnDate}
                    onChange={setReturnDate}
                    // Cannot be before the outbound journey (checked again in
                    // `journeySchema` on the server).
                    min={date || minDate}
                    required
                  />
                </Field>
                <Field id="return-time" label="Return time" required>
                  <TimePicker
                    id="return-time"
                    name="returnTime"
                    label="Return time"
                    value={returnTime}
                    onChange={setReturnTime}
                    required
                  />
                </Field>
              </div>

              <div className="gap-space-md grid sm:grid-cols-2">
                <Field
                  id="return-passengers"
                  name="returnPassengers"
                  type="number"
                  label="Passengers coming back"
                  required
                  min={1}
                  max={rules.maxPassengers}
                  defaultValue={defaults.returnPassengers}
                  icon={<Users className="h-5 w-5" />}
                />
                <Field
                  id="return-bags"
                  name="returnBags"
                  type="number"
                  label="Large suitcases coming back"
                  required
                  min={0}
                  max={rules.maxLargeBags}
                  defaultValue={defaults.returnBags}
                  icon={<Luggage className="h-5 w-5" />}
                  hint="Your vehicle is chosen to fit whichever journey carries more."
                />
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="gap-space-md flex flex-col">
        <h2 className="text-headline-sm">Flight details</h2>
        <p className="text-body-md text-on-surface-variant -mt-2">
          If we are collecting you from an airport, your flight number tells our team when
          to send your driver. You get {policies.airportFreeWaitingMinutes} minutes of
          free waiting from the time you land.
        </p>

        <div className="gap-space-md grid sm:grid-cols-2">
          <Field
            id="flight-number"
            name="flightNumber"
            label="Flight number"
            placeholder="e.g. BA117"
            defaultValue={defaults.flightNumber}
            autoCapitalize="characters"
            icon={<PlaneLanding className="h-5 w-5" />}
            hint="Needed for airport pickups."
            className="tnum"
          />
          <Field
            id="airline"
            name="airline"
            label="Airline"
            placeholder="e.g. British Airways"
            defaultValue={defaults.airline}
            icon={<Plane className="h-5 w-5" />}
          />
        </div>
      </section>

      <section className="gap-space-md flex flex-col">
        <h2 className="text-headline-sm">Passengers and luggage</h2>

        <div className="gap-space-md grid sm:grid-cols-2">
          <Field
            id="passengers"
            name="passengers"
            type="number"
            label="Passengers"
            required
            min={1}
            max={rules.maxPassengers}
            defaultValue={defaults.passengers}
            icon={<Users className="h-5 w-5" />}
          />
          <Field
            id="bags"
            name="bags"
            type="number"
            label="Large suitcases"
            required
            min={0}
            max={rules.maxLargeBags}
            defaultValue={defaults.bags}
            icon={<Luggage className="h-5 w-5" />}
            hint="Cabin bags are counted separately on the next screen."
          />
        </div>
      </section>

      <section className="gap-space-md flex flex-col">
        <h2 className="text-headline-sm">Anything else?</h2>
        <div>
          <label htmlFor="notes" className="text-label-md text-on-surface mb-1.5 block">
            Notes for your driver
            <span className="text-on-surface-variant ml-1.5 font-normal">optional</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={500}
            defaultValue={defaults.notes}
            placeholder="Anything that would help — a buzzer code, a side entrance, travelling with a pet."
            className={`${fieldControlClasses} h-auto py-3`}
          />
        </div>
      </section>

      <div className="border-outline-variant pt-space-lg flex flex-col gap-3 border-t sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-sm text-on-surface-variant">
          No account needed, and no card details until you book.
        </p>
        <button
          type="submit"
          className="bg-primary-container text-on-primary hover:bg-secondary rounded-button text-label-md flex h-12 items-center justify-center gap-2 px-6 font-semibold transition-colors"
        >
          See prices
          <ArrowRight aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

/** Route or hourly hire, matching the tabs on the quote widget. */
function ModeToggle({
  value,
  onChange,
}: {
  value: ServiceMode;
  onChange: (next: ServiceMode) => void;
}) {
  const options: { id: ServiceMode; label: string; hint: string }[] = [
    { id: "route", label: "Route", hint: "A to B, with a fixed fare" },
    { id: "hourly", label: "Hourly hire", hint: "A car and driver by the hour" },
  ];

  return (
    <fieldset className="gap-space-sm flex flex-col">
      <legend className="text-headline-sm mb-space-sm">
        What kind of booking is this?
      </legend>

      <div className="gap-space-md grid sm:grid-cols-2">
        {options.map((option) => {
          const active = option.id === value;
          return (
            <label
              key={option.id}
              className={[
                "rounded-card p-space-md flex cursor-pointer items-start gap-3 border transition-colors",
                active
                  ? "border-primary-container bg-surface-container-low"
                  : "border-outline-variant hover:border-primary-container",
              ].join(" ")}
            >
              <input
                type="radio"
                name="serviceChoice"
                value={option.id}
                checked={active}
                onChange={() => onChange(option.id)}
                className="accent-primary mt-0.5 h-4 w-4"
              />
              <span>
                <span className="text-title-md block">{option.label}</span>
                <span className="text-body-sm text-on-surface-variant">
                  {option.hint}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

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
        <div key={index} className="flex items-end gap-2">
          <Field
            id={`${idPrefix}-${index}`}
            name={name}
            label={`Extra stop ${index + 1}`}
            required
            value={stop}
            onChange={(event) =>
              onChange(
                stops.map((value, i) => (i === index ? event.target.value : value)),
              )
            }
            placeholder="Address or postcode"
            icon={<MapPin className="h-5 w-5" />}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => onChange(stops.filter((_, i) => i !== index))}
            aria-label={`Remove extra stop ${index + 1}`}
            className="text-on-surface-variant hover:text-error mb-0.5 flex h-12 w-12 items-center justify-center"
          >
            <X aria-hidden className="h-5 w-5" />
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
        Up to {max} extra stops can be booked online. Call us for more.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={onAdd}
      className="text-label-md text-primary inline-flex items-center gap-1.5 self-start"
    >
      <Plus aria-hidden className="h-4 w-4" />
      {count === 0 ? "Add a stop" : "Add another stop"}
    </button>
  );
}
